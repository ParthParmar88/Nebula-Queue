import { clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Tell tailwind-merge about the custom font sizes in tailwind.config.js. Without this it
// treats `text-13` as a text *color* and drops e.g. `text-danger` when both are present.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['2xs', '13'] }],
    },
  },
})

/** Join class names and let later Tailwind classes override earlier ones (e.g. a `className` prop). */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}
