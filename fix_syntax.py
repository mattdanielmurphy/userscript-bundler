import re

with open('/Users/matt/projects/userscript-bundler/bundler.cjs', 'r') as f:
    content = f.read()

# Replace the unescaped console.error with the escaped one.
old_line = '        console.error(`❌ [Bundler] Error in ${nameOrType}:`, errorMsg, errorObj);'
new_line = '        console.error(`❌ [Bundler] Error in \\${nameOrType}:`, errorMsg, errorObj);'
new_line = new_line.replace('`', '\\`')

content = content.replace(old_line, new_line)

with open('/Users/matt/projects/userscript-bundler/bundler.cjs', 'w') as f:
    f.write(content)

print("Done fixing syntax.")
