// Compara por palabra completa: evita que "Go" coincida con "good" o que "Java"
// coincida con "JavaScript". Los símbolos de C++ y C# se respetan como parte del
// token, y "Node" sí coincide con "Node.js" (el punto no es carácter de palabra).
export function mentionsToken(text: string, token: string): boolean {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    return false;
  }
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<![\\w+#.])${escaped}(?![\\w+#])`, 'i');
  return pattern.test(text);
}
