import type { KnipConfig } from 'knip'

const config: KnipConfig = {
  ignore: ['src/components/ui/**', 'src/routeTree.gen.ts', 'src/api/schema.d.ts'],
  // Let knip see the packages imported from CSS (Tailwind, self-hosted fonts).
  compilers: {
    css: (text: string) =>
      [...text.matchAll(/(?<=@)import[^;]+/g)].join('\n'),
  },
}

export default config
