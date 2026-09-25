import ts from "typescript";

export interface ExtractedImport {
  specifier: string;
  line: number;
  column: number;
  sourceLineText: string;
  isTypeOnly: boolean;
}

/**
 * TypeScript AST を走査してソースファイルからインポート文を抽出する
 */
export function extractImportsFromSource(filePath: string, sourceText: string): ExtractedImport[] {
  const sourceFile = ts.createSourceFile(
    filePath,
    sourceText,
    ts.ScriptTarget.Latest,
    true
  );

  const lines = sourceText.split(/\r?\n/);
  const imports: ExtractedImport[] = [];

  function visit(node: ts.Node): void {
    // 1. 静的インポート (import ... from "...")
    if (ts.isImportDeclaration(node)) {
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const sourceLineText = lines[line] || "";
        const isTypeOnly = node.importClause?.isTypeOnly ?? false;

        imports.push({
          specifier,
          line: line + 1,
          column: character + 1,
          sourceLineText: sourceLineText.trim(),
          isTypeOnly,
        });
      }
    }

    // 2. 再エクスポート (export ... from "...")
    if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
        const sourceLineText = lines[line] || "";
        const isTypeOnly = node.isTypeOnly;

        imports.push({
          specifier,
          line: line + 1,
          column: character + 1,
          sourceLineText: sourceLineText.trim(),
          isTypeOnly,
        });
      }
    }

    // 3. 動的インポート import("...") および require("...")
    if (ts.isCallExpression(node)) {
      const isDynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const isRequire = ts.isIdentifier(node.expression) && node.expression.text === "require";

      if ((isDynamicImport || isRequire) && node.arguments.length > 0) {
        const firstArg = node.arguments[0];
        if (firstArg && ts.isStringLiteral(firstArg)) {
          const specifier = firstArg.text;
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
          const sourceLineText = lines[line] || "";

          imports.push({
            specifier,
            line: line + 1,
            column: character + 1,
            sourceLineText: sourceLineText.trim(),
            isTypeOnly: false,
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return imports;
}
