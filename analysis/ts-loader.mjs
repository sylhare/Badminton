export async function resolve(specifier, context, defaultResolve) {
  if (specifier.startsWith('.') && !specifier.endsWith('.ts') && !specifier.endsWith('.js')) {
    try {
      return await defaultResolve(`${specifier}.ts`, context, defaultResolve);
    } catch {
      // fall through to default resolver
    }
  }

  return defaultResolve(specifier, context, defaultResolve);
}
