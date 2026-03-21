import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'zod';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    draft: z.boolean().default(false),
    slug: z.string().optional(),
    tags: z.array(z.string()).default([]),
    featureImage: z.string().optional(),
    hero: z.object({
      type: z.enum(['brain-atlas']),
      fullBleed: z.boolean().default(false),
      replaceTitle: z.boolean().default(false),
      caption: z.string().optional(),
      maxWidth: z.string().optional(),
    }).optional(),
    useImageAsTitle: z.string().optional(),
    ogImage: z.string().optional(),
    externalLink: z.url().optional(),
    disableComments: z.boolean().default(false),
  }),
});

export const collections = { posts };
