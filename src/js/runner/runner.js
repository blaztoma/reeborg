require("./../rur.js");
require("./../translator.js");
require("./../drawing/visible_world.js");
require("./../editors/update.js");
require("./../programming_api/blockly.js");
require("./../recorder/recorder.js");
require("./world_init.js");
require("./../editors/create.js");
require("./../utils/supplant.js");

RUR.runner = {};

/* A user program is evaluated when the user clicks on "run" or "step" for
   the first time and the result is stored in a series of frames.
   The playback is then done automatically (clicking on "run") or can be done
   frame by frame (clicking on "step").  When clicking on "step" repeatedly,
   we do not need to evaluate the program again, but simply to show a frame
   recorded.  The RUR.state.code_evaluated flag is used to determine if we
   only need to show a frame already recorded, or if we need to evaluate the
   program.
 */

RUR.runner.run = function (playback) {
    "use strict";
    var fatal_error_found = false, xml, xml_text;
    if (!RUR.state.code_evaluated) {
        if (RUR.state.editing_world) {
        // TODO: check that this is ok
        RUR.WORLD_AFTER_ONLOAD = RUR.clone_world(RUR.get_current_world());
        }
        RUR.set_current_world(RUR.clone_world(RUR.WORLD_AFTER_ONLOAD));
        RUR.world_init();

        if (!(({"python": true, "javascript": true, "coffeescript": true, "cpp": true})[RUR.state.programming_language] && RUR.state.highlight) ) {
            RUR.record_frame();  // record the starting state as first frame;
            // for python with highlighting on, the first frame will be the first
            // instruction to be executed highlighted.
        }

        if (RUR.state.input_method === "blockly-py") {
            editor.setValue(Blockly.Python.workspaceToCode(RUR.blockly.workspace));
        } else if (RUR.state.input_method === "blockly-js") {
            editor.setValue(Blockly.JavaScript.workspaceToCode(RUR.blockly.workspace));
        }
        if (RUR.state.input_method === "blockly-py" ||
            RUR.state.input_method === "blockly-js") {
                xml = Blockly.Xml.workspaceToDom(RUR.blockly.workspace);
                xml_text = Blockly.Xml.domToText(xml);
                localStorage.setItem("blockly", xml_text);
        }
        fatal_error_found = RUR.runner.eval(editor.getValue()); // jshint ignore:line
    }
    $("#thought").hide();
    if (!fatal_error_found) {
        // save program so that it a new browser session can use it as
        // starting point.
        try {
            localStorage.setItem("editor", editor.getValue());
            localStorage.setItem("library", library.getValue());
        } catch (e) {}
        // "playback" is a function called to play back the code in a sequence of frames
        // or a "null function", f(){} can be passed if the code is not
        // dependent on the robot world.
        if (RUR.state.prevent_playback) {
            return;
        }
    }
    
    playback();
};

/* RUR.runner.eval returns true if a fatal error is found, false otherwise */
RUR.runner.eval = function(src) {  // jshint ignore:line
    "use strict";
    var message, response, other_info, error;
    other_info = '';

    /* At some point around version 3.2.0, Brython changed the way it
       handled uncaught errors, and no longer pass a "nice" object
       to the surrounding Javascript environment - since this is not
       the way Brython programmers normally do things.   While this
       has been changed back some time after version 3.2.3, we nonetheless
       guard against any future changes by doing our own handling. */

    RUR.__python_error = false;
    RUR.__cpp_error = false;
    RUR.__reeborg_failure = false;
    RUR.__reeborg_success = false;
    try {
        if (RUR.state.programming_language === "javascript") {
            RUR.runner.eval_javascript(src);
        } else if (RUR.state.programming_language === "coffeescript") {
            RUR.runner.eval_coffeescript(src);
        } else if (RUR.state.programming_language === "python") {
            RUR.runner.eval_python(src);
            // This is the error handling referenced in the above comment.
            if (RUR.__python_error) {
                throw RUR.__python_error;
            }
        } else if (RUR.state.programming_language === "cpp") {
            RUR.runner.eval_cpp(src);
        } else {
            alert("FATAL ERROR: Unrecognized programming language. " + RUR.state.programming_language);
            return true;
        }
    } catch (e) {
        console.log("error caught");
        console.log(e);

        RUR.state.code_evaluated = true;
        if (RUR.__debug){
            console.dir(e);
            console.log(RUR.frames);
        }
        error = {};

        if (RUR.__reeborg_failure) {
            error.reeborg_failure = RUR.__reeborg_failure;
        }

        if (RUR.state.programming_language === "python") {
            response = RUR.runner.simplify_python_traceback(e);
            message = response.message;
            other_info = response.other_info;
            error.name = response.error_name;
            let translated_error;
            translated_error = RUR.translate(message);
            error.message = "<h3>" + error.name + "</h3><p>" +
                translated_error + "</p><p>" + other_info + '</p>';
            if (RUR.state.prevent_playback) {
                RUR.show_feedback("#Reeborg-success", e.reeborg_success);
            } else {
                RUR.record_frame("error", error);
            }
            if (error.name === "ReeborgOK") return false;
            if (error.name === "ReeborgError") return false;
            if (error.name === "MissingObjectError") return false;
            if (error.name === "WallCollisionError") return false;
        } else {
            error.name = e.name;
            message = e.message;
            other_info = '';
            error.reeborg_failure = e.message;
        }

        if (error.reeborg_failure !== undefined){
            RUR.record_frame("error", error);
        } else {
            RUR.record_frame("error", {message:"<h3>" + error.name + "</h3><p>" + message + "</p><p>" + other_info + '</p>'});
            $("#Reeborg-success").dialog("close");
            return true;
        }
    }
    RUR.state.code_evaluated = true;
    return false;
};

RUR.add_ai_button = function(error) {
    let button_string;
    let call = "RUR.makeRequest('ree_explanations', '" + error.message + "');";
    button_string = "<button id=\"explanation_button\" class=\"blue-gradient\" onclick=\"" + call + "\">DI paaiškinimas</button>";
    button_string += "<div id=\"AI_hints\"></div>";
    return button_string;
}

RUR.displayAIfailure = function(error) {
    document.getElementById("AI_hints").classList.remove('invisible');
    document.getElementById("AI_hints").classList.add('visible');
    document.getElementById("AI_hints").innerHTML = "<pre style='white-space: pre-wrap;'>" + error.message + "</pre>";
}

RUR.displayAIresults = function(data) {
    RUR.show_feedback("#Reeborg-shouts",
        "<h3>Paaiškinimas (nebūtinai teisingas)</h3><p>" +
        "<pre style='white-space: pre-wrap;'>" + data.choices[0].message.content + "</pre>");
    // document.getElementById("AI_hints").innerHTML = "<pre style='white-space: pre-wrap;'>" + data.choices[0].message.content + "</pre>";
}

RUR.makeRequest = function(purpose, error) {

    let baseUrl = 'https://arzinai.lt/scormAPI/';
    let editor_code = editor.getValue();
    let library_code = library.getValue();

    var postData = {
        "code" : incrs.encode(editor_code),
        "library" : incrs.encode(library_code),
        "error" : incrs.encode(error),
        "language" : 'lt'
    };

    var requestOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(postData)
    };

    document.getElementById("AI_hints").innerHTML = '';
    node = document.getElementById("loading_spinner");
    clone = node.cloneNode(true);
    document.getElementById("AI_hints").append(clone);

    let apiUrl = baseUrl + purpose;

    fetch(apiUrl, requestOptions)
        .then(response => response.json())
        .then(data => {
            RUR.displayAIresults(data);
        })
        .catch(error => {
            RUR.displayAIfailure(error);
        });

    if(purpose === "explanations") {
        document.getElementById("explanation_button").style.display = "none";
    }

    // TODO : make corrections and purpose buttons
    // if(purpose == "corrections") {
    //     document.getElementById("correction_button").style.display = "none";
    // }
    // if(purpose == "reviews") {
    //     document.getElementById("review_button").style.display = "none";
    // }
}

var incrs={_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(r){var e,t,o,a,h,d,C,c="",f=0;for(r=incrs._utf8_encode(r);f<r.length;)e=r.charCodeAt(f++),t=r.charCodeAt(f++),o=r.charCodeAt(f++),a=e>>2,h=(3&e)<<4|t>>4,d=(15&t)<<2|o>>6,C=63&o,isNaN(t)?d=C=64:isNaN(o)&&(C=64),c=c+this._keyStr.charAt(a)+this._keyStr.charAt(h)+this._keyStr.charAt(d)+this._keyStr.charAt(C);return c},decode:function(r){var e,t,o,a,h,d,C,c="",f=0;for(r=r.replace(/[^A-Za-z0-9\+\/\=]/g,"");f<r.length;)a=this._keyStr.indexOf(r.charAt(f++)),h=this._keyStr.indexOf(r.charAt(f++)),d=this._keyStr.indexOf(r.charAt(f++)),C=this._keyStr.indexOf(r.charAt(f++)),e=a<<2|h>>4,t=(15&h)<<4|d>>2,o=(3&d)<<6|C,c+=String.fromCharCode(e),64!=d&&(c+=String.fromCharCode(t)),64!=C&&(c+=String.fromCharCode(o));return incrs._utf8_decode(c)},_utf8_encode:function(r){r=r.replace(/\r\n/g,"\n");for(var e="",t=0;t<r.length;t++){var o=r.charCodeAt(t);o<128?e+=String.fromCharCode(o):o>127&&o<2048?(e+=String.fromCharCode(o>>6|192),e+=String.fromCharCode(63&o|128)):(e+=String.fromCharCode(o>>12|224),e+=String.fromCharCode(o>>6&63|128),e+=String.fromCharCode(63&o|128))}return e},_utf8_decode:function(r){for(var e="",t=0,o=c1=c2=0;t<r.length;)(o=r.charCodeAt(t))<128?(e+=String.fromCharCode(o),t++):o>191&&o<224?(e+=String.fromCharCode((31&o)<<6|63&(c2=r.charCodeAt(t+1))),t+=2):(e+=String.fromCharCode((15&o)<<12|(63&(c2=r.charCodeAt(t+1)))<<6|63&(c3=r.charCodeAt(t+2))),t+=3);return e}}

RUR.runner.eval_javascript = function (src) {
    // do not "use strict"
    var pre_code, post_code;
    pre_code = pre_code_editor.getValue();
    post_code = post_code_editor.getValue();
    const definitions = RUR.reset_definitions();
    eval(pre_code);
    src = src + "\n" + post_code;

    const JSInterpreter = (function() {
        let interp = null;

        const InjectedAPI = function(interp, globalObject) {
            for(let methodName in definitions) {
                interp.setProperty(globalObject, methodName, interp.createNativeFunction(definitions[methodName]));
            }
        };

        const isLine = (function() {
            let oldStack = [];

            return function(stack) {
                const state = stack[stack.length - 1];
                const node = state.node;
                const type = node.type;
          
                if (type !== 'VariableDeclaration' && type.substr(-9) !== 'Statement') {
                  return false;
                }
          
                if (type === 'BlockStatement') {
                  return false;
                }
          
                if (type === 'VariableDeclaration' && stack[stack.length - 2].node.type === 'ForStatement') {
                  return false;
                }
          
                if (oldStack[oldStack.length - 1] === state) {
                  return false;
                }
          
                if (oldStack.indexOf(state) !== -1 && type !== 'ForStatement' && type !== 'WhileStatement' && type !== 'DoWhileStatement') {
                  return false;
                }
          
                oldStack = stack.slice();
                return true;
            };
        })();
        
        return {
            eval: function(src) {
                interp = new Interpreter(src, InjectedAPI);
                return this;
            },
            step: function() {
                let OK = false;

                const stack = interp.getStateStack();
                const lineno = stack[stack.length - 1].node.aa.start.line - 3;

                let stepAgain = !isLine(stack);
                try {
                    OK = interp.step();
                } catch (exception) {
                    RUR.set_lineno_highlight([lineno + 1]);
                    if (!RUR.state.done_executed) {
                        RUR.__reeborg_failure = true;
                        RUR.record_frame("error", { message: exception.message });
                    }
                } finally {
                    if (!OK) {
                        stepAgain = false;
                    }
                }

                if (stepAgain)
                    return this.step();

                if (OK) {
                    RUR.set_lineno_highlight([lineno]);
                }

                return OK;
            },
            highlightRun: function() {
                const nextStep = () => {
                    if (this.step()) {
                        window.setTimeout(nextStep, 0);
                    }
                };

                nextStep();
            },
            run: function() {
                interp.run();
            }
        };
    })();
/*
    try {
        const interp = JSInterpreter.eval(src);
        interp[RUR.state.highlight ? "highlightRun" : "run"]()
    } catch (e) {
        if (RUR.state.done_executed) {
            const interp = JSInterpreter.eval(post_code);
            interp[RUR.state.highlight ? "highlightRun" : "run"]()
        }
        throw e;// throw original message from Done if nothing else is raised
    }
*/
    try {
        const interp = JSInterpreter.eval(src);
        interp[RUR.state.highlight ? "highlightRun" : "run"]()
    } catch (error) {
        if (RUR.state.done_executed){
            const interp = JSInterpreter.eval(post_code);
            interp[RUR.state.highlight ? "highlightRun" : "run"]()
        }
        RUR.record_frame("error", error);
        throw error;
    }
    if (RUR.state.done_executed){
        throw new RUR.ReeborgError(RUR.translate("Done!"));
    }
};

RUR.runner.eval_coffeescript = function (src) {
    // do not "use strict"
    var pre_code, post_code;
    pre_code = pre_code_editor.getValue();
    post_code = post_code_editor.getValue();
    RUR.reset_definitions();
    src = pre_code + "\n" + src + "\n" + post_code;
    try {
        eval(CoffeeScript.compile(src, {bare: true})); // jshint ignore:line
    } catch (e) {
        if (RUR.state.done_executed){
            eval(post_code); // jshint ignore:line
        }
        if (!RUR.state.done_executed){
            RUR.__reeborg_failure = true;
            RUR.record_frame("error", {message:e.message});
        }
        throw e;// throw original message from Done if nothing else is raised
    }
};

RUR.runner.eval_python = function (src) {
    // do not  "use strict"
    var pre_code, post_code;
    RUR.reset_definitions();
    pre_code = pre_code_editor.getValue();
    post_code = "\n" + post_code_editor.getValue();
    translate_python(src, RUR.state.highlight, RUR.state.watch_vars, pre_code, post_code);
};

RUR.runner.eval_cpp = function (src) {    
    // do not "use strict"
    var pre_code, post_code;
    pre_code = pre_code_editor.getValue();
    post_code = post_code_editor.getValue();
    const definitions = RUR.reset_definitions();
    eval(pre_code);

    // stopExecutionFlag = false;

    const config = {
        reeborg: definitions,
        debug: false,
        stdio: {
            finishCallback: function(exitCode) {
                console.log(`JSCPP: program exited with code " + ${exitCode};`);
                eval(post_code);
            },
            promiseError: function(promise_error) {
                try{ // highlight problematic line if a Syntax Error occurs
                    var lineno = promise_error.split(":")[0];
                    if (parseInt(lineno)) {
                        RUR.set_lineno_highlight([lineno - 1]);
                    }
                } catch(e){}
                if (!RUR.state.done_executed){
                    RUR.__reeborg_failure = true;
                    RUR.record_frame("error", {message:promise_error});
                }
            },
            write: function(s) {
                console.log(`JSCPP: ${s}`);
                RUR._write_(s);
            }
        },
        set_lineno_highlight: function(lineno) {
            RUR.set_lineno_highlight([lineno - 1]);
        },
        // stopExecutionCheck: function() {
        //     return stopExecutionFlag;
        // },
        //maxExecutionSteps: (100 * 100) * 10, // (lines of code * loop iterations) * 10 times buffer
        maxTimeout: 3 * 60 * 1000, // 3 mins
        eventLoopSteps: 10_000,
        unsigned_overflow: "error"
    };

    try {
        // stopExecutionFlag = false;
        JSCPP.run(src, () => Promise.resolve(), config);
        eval(post_code);
    } catch (error) {
        if (RUR.state.done_executed){
            eval(post_code);
        }
        RUR.record_frame("error", error);
        throw error;
    }
    if (RUR.state.done_executed){
        throw new RUR.ReeborgError(RUR.translate("Done!"));
    }
};

RUR.runner.simplify_python_traceback = function(e) {
    "use strict";
    var message, error_name, other_info, diagnostic, parts;
    other_info = '';
    if (e.reeborg_shouts === undefined) {
        message = e.args[0];
        error_name = e.__name__ || e.__class__.__name__;
        diagnostic = '';
        switch (error_name) {
            case "SyntaxError":
                try {
                    other_info = RUR.runner.find_line_number(e.args[4]);
                    if (RUR.runner.check_colons(e.args[4])) {
                        other_info += RUR.translate("<br>Perhaps a missing colon is the cause.");
                    } else if (RUR.runner.check_func_parentheses(e.args[4])){
                        other_info += RUR.translate("<br>Perhaps you forgot to add parentheses ().");
                    } else {
                        console.log(e.args);
                    }
                    try {
                        other_info = "<pre class='error'>" + e.args[4] + "</pre>" + other_info;
                    } catch (e1) {
                        console.log("error in simplifying traceback: ", e1);
                    }
                } catch (e2) { // jshint ignore:line
                    other_info = "I could not analyze this error; you might want to contact my programmer with a description of this problem.";
                    console.log("error in simplifying traceback: ", e2);
                }
                break;
            case "IndentationError":
                message = RUR.translate("The code is not indented correctly.");
                try {
                    other_info = RUR.runner.find_line_number(e.args[4]);
                    if (e.args[4].indexOf("RUR.set_lineno_highlight([") == -1){
                        other_info = "<pre class='error'>" + e.args[4] + "</pre>" + other_info;
                    } else if (RUR.state.highlight) {
                        other_info += "Try turning off syntax highlighting; if this fixes the problem, please file a bug.";
                    }
                } catch (e1) {  // jshint ignore:line
                    if (RUR.state.highlight) {
                        other_info += "Try turning off syntax highlighting; if this fixes the problem, please file a bug.";
                    } else {
                        other_info = "I could not analyze this error; you might want to contact my programmer with a description of this problem.";
                        other_info = "<pre class='error'>" + e.args[4] + "</pre>" + other_info;
                    }
                }
                break;
            case "NameError":
                try {
                    parts = message.split("'");
                    if (parts.length == 3 && parts[0] == "name " && parts[2] == " is not defined" ) {
                        message = parts[1];
                        other_info = RUR.runner.find_line_number(message);
                        other_info += RUR.translate("<br>Perhaps you misspelled a word or forgot to define a function or a variable.");
                    }
                } catch (e1) {  // jshint ignore:line
                    other_info = "I could not analyze this error; you might want to contact my programmer.";
                }
                break;
            case "Internal Javascript error: SyntaxError":
            case "Internal Javascript error: TypeError":
                error_name = "Invalid Python Code - " + error_name;
                console.log(e.args);
                message = '';
                other_info = RUR.translate("I cannot help you with this problem.");
                break;
            default:
                other_info = "";
        }
    } else {
        message = e.reeborg_shouts;
        if (e.__name__ === undefined) {
            error_name = "ReeborgError";
        } else {
            error_name = e.__name__;
        }
    }
    return {message:message, other_info:other_info, error_name:error_name};
};


RUR.runner.find_line_number = function(bad_code) {
    /** With the possibility of having code inserted by the highlighting routine,
        with some pre-code, and with Brython not counting empty lines at the
        beginning of a program, it is more reliable to scan the source code
        for the offending code as identified by Brython and see if it occurs
        only once in the user's program */

    var lines, lineno;
    if (bad_code.indexOf("RUR.set_lineno_highlight([") != -1){
        bad_code = bad_code.replace("RUR.set_lineno_highlight([", "");
        lines = bad_code.split("]");
        lineno = lines[0] + 1;
        return RUR.translate("Error found at or near line {number}.").supplant({number: lineno.toString()});
    }
    lines = editor.getValue().split("\n");
    for (lineno=0; lineno<lines.length; lineno++) {
        if(lines[lineno].indexOf(bad_code) != -1){
            return RUR.translate(
                    "Error found at or near line {number}.").supplant(
                        {number: (lineno+1).toString()});
        }
    }
    return '';
};


RUR.runner.check_colons = function(line_of_code) {
    "use strict";
    var tokens, nb_token;
    tokens = ['if ', 'if(', 'else', 'elif ','elif(','while ','while(',
              'for ','for(', 'def '];
    for (nb_token=0; nb_token < tokens.length; nb_token++){
        if (line_of_code.indexOf(tokens[nb_token]) != -1){
            if (line_of_code.indexOf(":") == -1){
                return true;    // missing colon
            }
        }
    }
    return false;  // no missing colon
};

RUR.runner.check_func_parentheses = function(line_of_code) {
    if (line_of_code.indexOf('def') != -1){
        if (line_of_code.indexOf("(") == -1){
            return true;    // missing parentheses
        }
    }
    return false;  // no missing parentheses
};
