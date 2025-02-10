import { ArrayVariable, CRuntime, VariableType, Variable } from "../rt";

export = {
    load(rt: CRuntime) {
        const { reeborg } = rt.config;
        
        const argumentTranslation = (function() {
            const translationLayer: Record<string, (arg: Variable) => any> = {
                "{!(wchar_t)}": function(arg: ArrayVariable) {
                    return rt.getStringFromCharArray(arg);
                },
                "{!(char)}": function(arg: ArrayVariable) {
                    return rt.getStringFromCharArray(arg);
                },
            };

            return function(args: Variable[]) {
                const translatedArguments: any[] = [];
                
                for (const arg of args) {
                    const signature: string = rt.getTypeSignature(arg.t);
                    translatedArguments.push(translationLayer[signature]?.(arg) ?? arg.v);
                }

                return translatedArguments;
            }
        })();

        const registerFunction = function(methodName: string, callback: (...args: any) => any) {
            rt.regFunc(function(rt: CRuntime, _this: any, ...args: Variable[]) {
                const result = callback(...argumentTranslation(args));
   
                if (Array.isArray(result)) {
                    if (result.every((item) => typeof item === "string")) {
                        if (result.length == 1)
                            return rt.makeCharArrayFromString(result[0], rt.detectWideCharacters(result[0]) ? rt.wcharTypeLiteral.name : rt.charTypeLiteral.name);
                        return rt.val(rt.arrayPointerType(rt.simpleClassType("string"), result.length), rt.makeArrayPointerValue(result.map((item) => rt.makeCharArrayFromString(item, rt.detectWideCharacters(item) ? rt.wcharTypeLiteral.name : rt.charTypeLiteral.name)), 0));
                    } else if (result.every((item) => typeof item === "number")) {
                        return rt.val(rt.arrayPointerType(rt.intTypeLiteral, result.length), rt.makeArrayPointerValue(result.map((item) => rt.val(rt.intTypeLiteral, item)), 0));
                    } else if (result.every((item) => typeof item === "object")) {
                        rt.raiseException("object array returnal functionality not yet implemented");
                    }
                } 

                return rt.val(rt.boolTypeLiteral, (result ?? 1) > 0);
            }, "global", methodName, ["?"], "?" as unknown as VariableType);
        };

        for(let methodName in reeborg) {
            registerFunction(methodName, reeborg[methodName]);
        }
    }
};