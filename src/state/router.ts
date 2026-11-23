import { useEffect, useState } from 'react';

// Hash routing keeps the app deployable as static files (and inside sandboxed previews).
export const ROUTES = [
  'home',
  'upload',
  'language',
  'processing',
  'menu',
  'saved',
  'preferences',
  'about',
  'how-it-works',
  'privacy',
  'contact',
  'disclaimer',
] as const;
export type Route = (typeof ROUTES)[number];

function parse(): Route {
  const h = window.location.hash.replace(/^#\/?/, '');
  return (ROUTES as readonly string[]).includes(h) ? (h as Route) : 'home';
}

export function navigate(route: Route) {
  if (parse() === route) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = route === 'home' ? '' : route;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo({ top: 0 });
      // Move focus to the main landmark so screen-reader users hear the new page.
      requestAnimationFrame(() => document.getElementById('main')?.focus({ preventScroll: true }));
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
