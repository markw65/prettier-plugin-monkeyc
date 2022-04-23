import Toybox.Activity;
import Toybox.Application;
import Toybox.Lang;
import Toybox.System;
import Toybox.Test;
import Toybox.Time;
import Toybox.WatchUi;
import Toybox.System;

class testCasesApp extends Application.AppBase {
    function initialize() {
        AppBase.initialize();
    }

    // onStart() is called on application start up
    function onStart(state as Dictionary?) as Void {
        var tests = getExprs();
        for (var i = 0; i < tests.size(); i++) {
            System.println(checkStr(i, tests[i][0], tests[i][1])[0]);
        }
    }

    // onStop() is called when your application is exiting
    function onStop(state as Dictionary?) as Void {}

    // Return the initial view of your application here
    function getInitialView() as Array<Views or InputDelegates>? {
        return [new testCasesView()] as Array<Views>;
    }
}

class testCasesView extends WatchUi.SimpleDataField {
    public function initialize() {
        SimpleDataField.initialize();
    }

    public function compute(
        info as Info
    ) as Numeric or Duration or String or Null {
        return 42;
    }
}

function getApp() as testCasesApp {
    return Application.getApp() as testCasesApp;
}

function checkDict(expected, actual) {
    for (var i = 0; i < expected.size(); i++) {
        var e = expected[i];
        if (actual[e[0]] != e[1]) {
            return false;
        }
    }
    return true;
}

function checkStr(i, expected, actual) {
    var ok =
        actual instanceof Lang.Dictionary
            ? checkDict(expected, actual)
            : actual has :equals
            ? actual.equals(expected)
            : actual == expected;
    return [
        ok,
        Lang.format("tests[$1$]: got $2$, expected $3$. $4$", [
            i,
            actual,
            expected,
            ok ? "ok" : "FAILED!",
        ]),
    ];
}

function check(logger, i, expected, actual) {
    var result = checkStr(i, expected, actual);
    if (result[1]) {
        logger.debug(result[0]);
    } else {
        logger.error(result[0]);
    }
    return result[0];
}

function getExprs() as Array<Array> {
    return (
        [
            [4, 1 << (2 % 3)],
            [1, (1 << 2) % 3],
            [true, (4 + 5) instanceof Lang.Number],
            [true, ((4 + 5) has :toString) as Boolean],
            [[[2, 3], [-1, 4]], { 1 ? 2 : 3 => 3, -1 => 4 }],
            [true, 4e0 instanceof Lang.Float],
        ] as Array<Array>
    );
}

(:test)
function runTests(logger as Logger) as Boolean {
    var tests = getExprs();
    var ok = true;
    for (var i = 0; i < tests.size(); i++) {
        if (!check(logger, i, tests[i][0], tests[i][1])) {
            ok = false;
        }
    }
    return ok;
}
