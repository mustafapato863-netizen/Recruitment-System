export type AtmosphereVariant = 'auth' | 'dashboard' | 'workspace';

interface AtmosphericBackgroundProps {
  className?: string;
  variant?: AtmosphereVariant;
}

/**
 * Ambient glow/drift backgrounds are disabled per the Notion-inspired SGH
 * surface and performance specification.
 */
export function AtmosphericBackground(_props: AtmosphericBackgroundProps) {
  return null;
}
