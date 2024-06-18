import { ArrayVariable, CRuntime, Variable } from "../rt";

export = {
    load(rt: CRuntime) {
        const { reeborg } = rt.config;
        
        const argumentTranslation = (function() {
            const translationLayer: Record<string, (arg: Variable) => any> = {
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
                callback(...argumentTranslation(args));
            }, "global", methodName, ["?"], rt.voidTypeLiteral);
        };

        for(let methodName in reeborg) {
            registerFunction(methodName, reeborg[methodName]);
        }
    }
};