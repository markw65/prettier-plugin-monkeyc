typedef TypeWithVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName as Number;
typedef TypeWithVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName2 as
    TypeWithVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName;
typedef TypeWithShortCommentedType as
    /* comment */ Number;
typedef TypeWithLongCommentedType as
    /* comment */ TypeWithVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName;

var variableWithVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName as
    TypeWithVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName;

function shortName() as Number {
    return 42;
}

function shortNameNoType() {
    return 42;
}

function functionWithVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName() as
    TypeWithVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName
{
    return (
        variableWithVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName as
        TypeWithVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName
    );
}

function anotherFunctionWithVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName(
    variableWithVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName as
        TypeWithVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName
) as Void {
    self.variableWithVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName =
        variableWithVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName;
}

class C
    extends TypeWithVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName
{
    function functionWithShortCommentedType() as /* comment */ Number {
        return 42;
    }

    function functionWithLongCommentedType() as
        /* comment */ TypeWithVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName
    {
        return 42;
    }

    function functionWithSingleLineCommentShortType() as
        // comment
        Number
    {
        return 42;
    }

    function functionWithSingleLineCommentLongType() as
        // comment
        TypeWithVeryVeryVeryVeryVeryVeryVeryVeryVeryLongName
    {
        return 42;
    }
}
