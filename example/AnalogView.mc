//
// Copyright 2016-2021 by Garmin Ltd. or its subsidiaries.
// Subject to Garmin SDK License Agreement and Wearables
// Application Developer Agreement.
//

import Toybox.Graphics;
import Toybox.Lang;
import Toybox.Math;
import Toybox.System;
import Toybox.Time;
import Toybox.Time.Gregorian;
import Toybox.WatchUi;

//! This implements an analog watch face
//! Original design by Austen Harbour
class AnalogView extends WatchUi.WatchFace {
    private var _font as FontResource?;
    private var _isAwake as Boolean?;
    private var _screenShape as ScreenShape;
    private var _dndIcon as BitmapResource?;
    private var _offscreenBuffer as BufferedBitmap?;
    private var _dateBuffer as BufferedBitmap?;
    private var _screenCenterPoint as Array<Number>?;
    private var _fullScreenRefresh as Boolean;
    private var _partialUpdatesAllowed as Boolean;

    //! Initialize variables for this view
    public function initialize() {
        WatchFace.initialize();
        _screenShape = System.getDeviceSettings().screenShape;
        _fullScreenRefresh = true;
        _partialUpdatesAllowed = (WatchUi.WatchFace has :onPartialUpdate);
    }

    //! Configure the layout of the watchface for this device
    //! @param dc Device context
    public function onLayout(dc as Dc) as Void {

        // Load the custom font we use for drawing the 3, 6, 9, and 12 on the watchface.
        _font = WatchUi.loadResource($.Rez.Fonts.id_font_black_diamond) as FontResource;

        // If this device supports the Do Not Disturb feature,
        // load the associated Icon into memory.
        if (System.getDeviceSettings() has :doNotDisturb) {
            _dndIcon = WatchUi.loadResource($.Rez.Drawables.DoNotDisturbIcon) as BitmapResource;
        } else {
            _dndIcon = null;
        }

        // If this device supports BufferedBitmap, allocate the buffers we use for drawing
        if (Graphics has :BufferedBitmap) {
            // Allocate a full screen size buffer with a palette of only 4 colors to draw
            // the background image of the watchface.  This is used to facilitate blanking
            // the second hand during partial updates of the display
            _offscreenBuffer = new Graphics.BufferedBitmap({
                :width=>dc.getWidth(),
                :height=>dc.getHeight(),
                :palette=> [
                    Graphics.COLOR_DK_GRAY,
                    Graphics.COLOR_LT_GRAY,
                    Graphics.COLOR_BLACK,
                    Graphics.COLOR_WHITE
                ] as Array<ColorValue>
            });

            // Allocate a buffer tall enough to draw the date into the full width of the
            // screen. This buffer is also used for blanking the second hand. This full
            // color buffer is needed because anti-aliased fonts cannot be drawn into
            // a buffer with a reduced color palette
            _dateBuffer = new Graphics.BufferedBitmap({
                :width=>dc.getWidth(),
                :height=>Graphics.getFontHeight(Graphics.FONT_MEDIUM)
            });
        } else {
            _offscreenBuffer = null;
        }

        _screenCenterPoint = [dc.getWidth() / 2, dc.getHeight() / 2] as Array<Number>;
    }

    //! This function is used to generate the coordinates of the 4 corners of the polygon
    //! used to draw a watch hand. The coordinates are generated with specified length,
    //! tail length, and width and rotated around the center point at the provided angle.
    //! 0 degrees is at the 12 o'clock position, and increases in the clockwise direction.
    //! @param centerPoint The center of the clock
    //! @param angle Angle of the hand in radians
    //! @param handLength The length of the hand from the center to point
    //! @param tailLength The length of the tail of the hand
    //! @param width The width of the watch hand
    //! @return The coordinates of the watch hand
    private function generateHandCoordinates(centerPoint as Array<Number>, angle as Float, handLength as Number, tailLength as Number, width as Number) as Array< Array<Float> > {
        // Map out the coordinates of the watch hand
        var coords = [[-(width / 2), tailLength] as Array<Number>,
                      [-(width / 2), -handLength] as Array<Number>,
                      [width / 2, -handLength] as Array<Number>,
                      [width / 2, tailLength] as Array<Number>] as Array< Array<Number> >;
        var result = new Array< Array<Float> >[4];
        var cos = Math.cos(angle);
        var sin = Math.sin(angle);

        // Transform the coordinates
        for (var i = 0; i < 4; i++) {
            var x = (coords[i][0] * cos) - (coords[i][1] * sin) + 0.5;
            var y = (coords[i][0] * sin) + (coords[i][1] * cos) + 0.5;

            result[i] = [centerPoint[0] + x, centerPoint[1] + y] as Array<Float>;
        }

        return result;
    }

    //! Draws the clock tick marks around the outside edges of the screen.
    //! @param dc Device context
    private function drawHashMarks(dc as Dc) as Void {
        var width = dc.getWidth();
        var height = dc.getHeight();

        // Draw hashmarks differently depending on screen geometry.
        if (System.SCREEN_SHAPE_ROUND == _screenShape) {
            var outerRad = width / 2;
            var innerRad = outerRad - 10;
            // Loop through each 15 minute block and draw tick marks.
            for (var i = Math.PI / 6; i <= 11 * Math.PI / 6; i += (Math.PI / 3)) {
                // Partially unrolled loop to draw two tickmarks in 15 minute block.
                var sY = outerRad + innerRad * Math.sin(i);
                var eY = outerRad + outerRad * Math.sin(i);
                var sX = outerRad + innerRad * Math.cos(i);
                var eX = outerRad + outerRad * Math.cos(i);
                dc.drawLine(sX, sY, eX, eY);
                i += Math.PI / 6;
                sY = outerRad + innerRad * Math.sin(i);
                eY = outerRad + outerRad * Math.sin(i);
                sX = outerRad + innerRad * Math.cos(i);
                eX = outerRad + outerRad * Math.cos(i);
                dc.drawLine(sX, sY, eX, eY);
            }
        } else {
            var coords = [0, width / 4, (3 * width) / 4, width] as Array<Number>;
            for (var i = 0; i < coords.size(); i++) {
                var dx = ((width / 2.0) - coords[i]) / (height / 2.0);
                var upperX = coords[i] + (dx * 10);
                // Draw the upper hash marks.
                dc.fillPolygon([[coords[i] - 1, 2] as Array<Float or Number>,
                                [upperX - 1, 12] as Array<Float or Number>,
                                [upperX + 1, 12] as Array<Float or Number>,
                                [coords[i] + 1, 2] as Array<Float or Number>] as Array< Array<Float or Number> >);
                // Draw the lower hash marks.
                dc.fillPolygon([[coords[i] - 1, height - 2] as Array<Float or Number>,
                                [upperX - 1, height - 12] as Array<Float or Number>,
                                [upperX + 1, height - 12] as Array<Float or Number>,
                                [coords[i] + 1, height - 2] as Array<Float or Number>] as Array< Array<Float or Number> >);
            }
        }
    }

    //! Handle the update event
    //! @param dc Device context
    public function onUpdate(dc as Dc) as Void {
        var screenWidth = dc.getWidth();
        var clockTime = System.getClockTime();
        var targetDc = null;

        // We always want to refresh the full screen when we get a regular onUpdate call.
        _fullScreenRefresh = true;
        var offscreenBuffer = _offscreenBuffer;
        if (null != offscreenBuffer) {
            dc.clearClip();
            // If we have an offscreen buffer that we are using to draw the background,
            // set the draw context of that buffer as our target.
            targetDc = offscreenBuffer.getDc();
        } else {
            targetDc = dc;
        }

        var width = targetDc.getWidth();
        var height = targetDc.getHeight();

        // Fill the entire background with Black.
        targetDc.setColor(Graphics.COLOR_BLACK, Graphics.COLOR_WHITE);
        targetDc.fillRectangle(0, 0, dc.getWidth(), dc.getHeight());

        // Draw a grey triangle over the upper right half of the screen.
        targetDc.setColor(Graphics.COLOR_DK_GRAY, Graphics.COLOR_DK_GRAY);
        targetDc.fillPolygon([[0, 0] as Array<Number>,
                              [targetDc.getWidth(), 0] as Array<Number>,
                              [targetDc.getWidth(), targetDc.getHeight()] as Array<Number>,
                              [0, 0] as Array<Number>] as Array< Array<Number> >);

        // Draw the tick marks around the edges of the screen
        drawHashMarks(targetDc);

        // Draw the do-not-disturb icon if we support it and the setting is enabled
        var dndIcon = _dndIcon;
        if ((null != dndIcon) && System.getDeviceSettings().doNotDisturb) {
            targetDc.drawBitmap(width * 0.75, height / 2 - 15, dndIcon);
        }

        // Use white to draw the hour and minute hands
        targetDc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);

        // Draw the hour hand. Convert it to minutes and compute the angle.
        var hourHandAngle = (((clockTime.hour % 12) * 60) + clockTime.min);
        hourHandAngle = hourHandAngle / (12 * 60.0);
        hourHandAngle = hourHandAngle * Math.PI * 2;

        targetDc.fillPolygon(generateHandCoordinates(_screenCenterPoint, hourHandAngle, 40, 0, 3));

        // Draw the minute hand.
        var minuteHandAngle = (clockTime.min / 60.0) * Math.PI * 2;
        targetDc.fillPolygon(generateHandCoordinates(_screenCenterPoint, minuteHandAngle, 70, 0, 2));

        // Draw the arbor in the center of the screen.
        targetDc.setColor(Graphics.COLOR_LT_GRAY, Graphics.COLOR_BLACK);
        targetDc.fillCircle(width / 2, height / 2, 7);
        targetDc.setColor(Graphics.COLOR_BLACK,Graphics.COLOR_BLACK);
        targetDc.drawCircle(width / 2, height / 2, 7);

        // Draw the 3, 6, 9, and 12 hour labels.
        var font = _font;
        if (font != null) {
            targetDc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_DK_GRAY);
            targetDc.drawText(width / 2, 2, font, "12", Graphics.TEXT_JUSTIFY_CENTER);
            targetDc.drawText(width - 2, (height / 2) - 15, font, "3", Graphics.TEXT_JUSTIFY_RIGHT);
            targetDc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_BLACK);
            targetDc.drawText(width / 2, height - 30, font, "6", Graphics.TEXT_JUSTIFY_CENTER);
            targetDc.drawText(2, (height / 2) - 15, font, "9", Graphics.TEXT_JUSTIFY_LEFT);
        }

        // If we have an offscreen buffer that we are using for the date string,
        // Draw the date into it. If we do not, the date will get drawn every update
        // after blanking the second hand.
        var dateBuffer = _dateBuffer;
        if ((null != dateBuffer) && (null != offscreenBuffer)) {
            var dateDc = dateBuffer.getDc();

            // Draw the background image buffer into the date buffer to set the background
            dateDc.drawBitmap(0, -(height / 4), offscreenBuffer);

            // Draw the date string into the buffer.
            drawDateString(dateDc, width / 2, 0);
        }

        // Output the offscreen buffers to the main display if required.
        drawBackground(dc);

        // Draw the battery percentage directly to the main screen.
        var dataString = (System.getSystemStats().battery + 0.5).toNumber().toString() + "%";
        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(width / 2, 3 * height / 4, Graphics.FONT_TINY, dataString, Graphics.TEXT_JUSTIFY_CENTER);

        if (_partialUpdatesAllowed) {
            // If this device supports partial updates and they are currently
            // allowed run the onPartialUpdate method to draw the second hand.
            onPartialUpdate(dc);
        } else if (_isAwake) {
            // Otherwise, if we are out of sleep mode, draw the second hand
            // directly in the full update method.
            dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
            var secondHand = (clockTime.sec / 60.0) * Math.PI * 2;

            dc.fillPolygon(generateHandCoordinates(_screenCenterPoint, secondHand, 60, 20, 2));
        }

        _fullScreenRefresh = false;
    }

    //! Draw the date string into the provided buffer at the specified location
    //! @param dc Device context
    //! @param x The x location of the text
    //! @param y The y location of the text
    private function drawDateString(dc as Dc, x as Number, y as Number) as Void {
        var info = Gregorian.info(Time.now(), Time.FORMAT_LONG);
        var dateStr = Lang.format("$1$ $2$ $3$", [info.day_of_week, info.month, info.day]);

        dc.setColor(Graphics.COLOR_WHITE, Graphics.COLOR_TRANSPARENT);
        dc.drawText(x, y, Graphics.FONT_MEDIUM, dateStr, Graphics.TEXT_JUSTIFY_CENTER);
    }

    //! Handle the partial update event
    //! @param dc Device context
    public function onPartialUpdate(dc as Dc) as Void {
        // If we're not doing a full screen refresh we need to re-draw the background
        // before drawing the updated second hand position. Note this will only re-draw
        // the background in the area specified by the previously computed clipping region.
        if (!_fullScreenRefresh) {
            drawBackground(dc);
        }

        var clockTime = System.getClockTime();
        var secondHand = (clockTime.sec / 60.0) * Math.PI * 2;
        var secondHandPoints = generateHandCoordinates(_screenCenterPoint, secondHand, 60, 20, 2);
        // Update the clipping rectangle to the new location of the second hand.
        var curClip = getBoundingBox(secondHandPoints);
        var bBoxWidth = curClip[1][0] - curClip[0][0] + 1;
        var bBoxHeight = curClip[1][1] - curClip[0][1] + 1;
        dc.setClip(curClip[0][0], curClip[0][1], bBoxWidth, bBoxHeight);

        // Draw the second hand to the screen.
        dc.setColor(Graphics.COLOR_RED, Graphics.COLOR_TRANSPARENT);
        dc.fillPolygon(secondHandPoints);
    }

    //! Compute a bounding box from the passed in points
    //! @param points Points to include in bounding box
    //! @return The bounding box points
    private function getBoundingBox(points as Array< Array<Number or Float> >) as Array< Array<Number or Float> > {
        var min = [9999, 9999] as Array<Number>;
        var max = [0,0] as Array<Number>;

        for (var i = 0; i < points.size(); ++i) {
            if (points[i][0] < min[0]) {
                min[0] = points[i][0];
            }

            if (points[i][1] < min[1]) {
                min[1] = points[i][1];
            }

            if (points[i][0] > max[0]) {
                max[0] = points[i][0];
            }

            if (points[i][1] > max[1]) {
                max[1] = points[i][1];
            }
        }

        return [min, max] as Array< Array<Number or Float> >;
    }

    //! Draw the watch face background
    //! onUpdate uses this method to transfer newly rendered Buffered Bitmaps
    //! to the main display.
    //! onPartialUpdate uses this to blank the second hand from the previous
    //! second before outputting the new one.
    //! @param dc Device context
    private function drawBackground(dc as Dc) as Void {
        var width = dc.getWidth();
        var height = dc.getHeight();

        // If we have an offscreen buffer that has been written to
        // draw it to the screen.
        var offscreenBuffer = _offscreenBuffer;
        if (null != offscreenBuffer) {
            dc.drawBitmap(0, 0, offscreenBuffer);
        }

        // Draw the date
        var dateBuffer = _dateBuffer;
        if (null != dateBuffer) {
            // If the date is saved in a Buffered Bitmap, just copy it from there.
            dc.drawBitmap(0, height / 4, dateBuffer);
        } else {
            // Otherwise, draw it from scratch.
            drawDateString(dc, width / 2, height / 4);
        }
    }

    //! This method is called when the device re-enters sleep mode.
    //! Set the isAwake flag to let onUpdate know it should stop rendering the second hand.
    public function onEnterSleep() as Void {
        _isAwake = false;
        WatchUi.requestUpdate();
    }

    //! This method is called when the device exits sleep mode.
    //! Set the isAwake flag to let onUpdate know it should render the second hand.
    public function onExitSleep() as Void {
        _isAwake = true;
    }

    //! Turn off partial updates
    public function turnPartialUpdatesOff() as Void {
        _partialUpdatesAllowed = false;
    }
}

//! Receives watch face events
class AnalogDelegate extends WatchUi.WatchFaceDelegate {
    private var _view as AnalogView;

    //! Constructor
    //! @param view The analog view
    public function initialize(view as AnalogView) {
        WatchFaceDelegate.initialize();
        _view = view;
    }

    //! The onPowerBudgetExceeded callback is called by the system if the
    //! onPartialUpdate method exceeds the allowed power budget. If this occurs,
    //! the system will stop invoking onPartialUpdate each second, so we notify the
    //! view here to let the rendering methods know they should not be rendering a
    //! second hand.
    //! @param powerInfo Information about the power budget
    public function onPowerBudgetExceeded(powerInfo as WatchFacePowerInfo) as Void {
        System.println("Average execution time: " + powerInfo.executionTimeAverage);
        System.println("Allowed execution time: " + powerInfo.executionTimeLimit);
        _view.turnPartialUpdatesOff();
    }
}
