import { useCallback, useEffect, useRef } from 'react';
import { Howl } from 'howler';

// Local copy first (public/cries is a clone of PokeAPI/cries), then the public repo.
const cryUrls = (id: number) => [
  `/cries/cries/pokemon/latest/${id}.ogg`,
  `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${id}.ogg`,
];

/** Loads a Pokémon's cry and plays it once loaded; `replay` plays it again. */
export function useCry(id: number | undefined) {
  const howl = useRef<Howl | null>(null);

  useEffect(() => {
    if (!id) return;
    const sources = cryUrls(id);
    let cancelled = false;

    const load = (i: number) => {
      if (cancelled || i >= sources.length) return;
      const h = new Howl({
        src: [sources[i]],
        format: ['ogg'],
        html5: true,
        volume: 0.6,
        onloaderror: () => {
          h.unload();
          load(i + 1);
        },
        onload: () => {
          if (cancelled) return h.unload();
          howl.current = h;
          h.play();
        },
      });
    };
    load(0);

    return () => {
      cancelled = true;
      howl.current?.unload();
      howl.current = null;
    };
  }, [id]);

  return useCallback(() => {
    howl.current?.stop();
    howl.current?.play();
  }, []);
}
