import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SafetyNotice, SAFETY_TEXT } from '../components/Feedback';
import { navigate, type Route } from '../state/router';

const PAGES: Partial<Record<Route, { title: string; body: ReactNode }>> = {
  about: {
    title: 'About MenuMate India AI',
    body: (
      <>
        <p>
          MenuMate India AI helps international visitors understand restaurant menus written in Indian regional languages. Photograph a menu, choose your
          language, and see each dish with its original name, a translation, a plain-language explanation and estimated spice and dietary information.
        </p>
        <p>
          It’s an independent MVP built with free-tier tools: a React web app, a small serverless API, and Google’s Gemini model for reading and translating
          menus, with Groq as an automatic backup. There’s no account and no tracking — your saved menus stay in your browser.
        </p>
      </>
    ),
  },
  'how-it-works': {
    title: 'How it works',
    body: (
      <>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong>Scan or upload.</strong> Your photo stays on your device. When you tap Translate, it’s resized and sent once, through our server, to the
            Gemini API.
          </li>
          <li>
            <strong>Read the menu.</strong> The AI reads dish names and prices exactly as printed, identifies the language, and flags any text it can’t read
            clearly. It is instructed never to invent dishes or prices — unreadable prices are left blank.
          </li>
          <li>
            <strong>Translate and explain.</strong> Each dish is translated (or transliterated when a translation would mislead) and given a short explanation,
            likely ingredients, a spice estimate and a dietary estimate, each with a confidence level.
          </li>
          <li>
            <strong>Check the results.</strong> Every AI response is validated before you see it. Prices always come from the menu reading step and can’t be
            changed by later AI steps. Dietary labels that contradict the listed ingredients are downgraded to “Unknown”.
          </li>
        </ol>
      </>
    ),
  },
  privacy: {
    title: 'Privacy',
    body: (
      <>
        <ul className="list-disc space-y-2 pl-5">
          <li>No registration, no account and no personal information collected.</li>
          <li>Menu photos are not sent anywhere until you tap Translate Menu.</li>
          <li>
            When you translate, a resized copy of the photo is sent through our serverless function to Google’s Gemini API, or to Groq if Gemini is busy.
            We don’t store it. Each provider’s handling of API data is governed by its own terms — on Google’s free tier, submitted content may be used to
            improve its products, so avoid photographing anything personal.
          </li>
          <li>API keys are kept on the server and never sent to your browser.</li>
          <li>Saved menus, favourites and preferences are stored in your browser’s localStorage on this device only. Only a small thumbnail of each photo is kept.</li>
          <li>You can delete saved menus, favourites and preferences at any time from My Menus or Preferences.</li>
        </ul>
      </>
    ),
  },
  contact: {
    title: 'Contact',
    body: (
      <>
        <p>MenuMate India AI is an MVP and portfolio project. Feedback on translation quality, missing dishes or accessibility is very welcome.</p>
        <p>
          If you deploy your own copy, replace this page with your own contact details (for example a feedback form or email address) in{' '}
          <code className="rounded bg-sage px-1">src/screens/InfoScreen.tsx</code>.
        </p>
      </>
    ),
  },
  disclaimer: {
    title: 'Disclaimer',
    body: (
      <>
        <p className="font-medium">{SAFETY_TEXT}</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Translations, descriptions, ingredients, spice levels and dietary labels are AI-generated estimates, not verified restaurant information.</li>
          <li>MenuMate never confirms that a dish is vegetarian, vegan, allergen-free or safe for an allergy. If you have an allergy, tell the staff and ask.</li>
          <li>Descriptions reflect typical recipes. Each restaurant’s version may differ.</li>
          <li>The sample menu uses demonstration data written for this app and does not represent a real restaurant.</li>
          <li>Prices are read from the photo and may be misread. Check the printed menu before ordering.</li>
        </ul>
      </>
    ),
  },
};

export function InfoScreen({ route }: { route: Route }) {
  const page = PAGES[route];
  if (!page) return null;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <button type="button" onClick={() => navigate('home')} className="mb-4 inline-flex min-h-11 items-center gap-1.5 rounded-lg font-medium text-brand">
        <ArrowLeft size={18} aria-hidden="true" /> Home
      </button>
      <h1 className="font-heading text-[30px] md:text-4xl">{page.title}</h1>
      <div className="card mt-6 space-y-4 p-6 text-[16px] leading-relaxed text-ink/90">{page.body}</div>
      {route !== 'disclaimer' && <SafetyNotice className="mt-6" />}
    </div>
  );
}
