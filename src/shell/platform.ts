/** True in the Android app build (`vite build --mode app`, ADR-0020); false on the web. */
export const IN_APP = import.meta.env.MODE === 'app';
