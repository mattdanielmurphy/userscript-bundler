import re

with open('/Users/matt/projects/userscript-bundler/bundler.cjs', 'r') as f:
    content = f.read()

# We want to replace the block starting at `const errorQueue = [];` up to the end of `updateErrorDot() { ... }`
# with a simple version of reportError.

new_code = """    function reportError(nameOrType, errorObj) {
        const errorMsg = errorObj ? (errorObj.message || String(errorObj)) : "Unknown error";
        console.error(`❌ [Bundler] Error in ${nameOrType}:`, errorMsg, errorObj);
    }"""

pattern = re.compile(r'    const errorQueue = \[\];.*?    function updateErrorDot\(\) \{.*?    \}', re.DOTALL)
replaced = pattern.sub(new_code, content)

with open('/Users/matt/projects/userscript-bundler/bundler.cjs', 'w') as f:
    f.write(replaced)

print("Done replacing.")
