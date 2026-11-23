import { ArrowRight, BookOpen, Camera, Flame, Languages, Leaf, ScanLine, UtensilsCrossed } from 'lucide-react';
import { ThaliIllustration } from '../components/Illustrations';
import { Button } from '../components/ui';
import { SafetyNotice } from '../components/Feedback';
import { SOURCE_LANGUAGES, TARGET_LANGUAGES } from '../lib/languages';
import { DEMO_MENU_ID } from '../data/sampleMenu';
import { navigate } from '../state/router';
import { useStore } from '../state/store';

const STEPS = [
  { icon: Camera, title: 'Scan or upload a restaurant menu', text: 'Take a photo of the menu, or pick one from your gallery.' },
  { icon: Languages, title: 'Select your preferred language', text: 'English, Spanish, French, German or Japanese.' },
  { icon: UtensilsCrossed, title: 'Understand every dish before ordering', text: 'See what each dish is, how spicy it might be and what’s likely in it.' },
];

const BENEFITS = [
  { icon: ScanLine, title: 'Understand regional Indian menus', text: 'Hindi, Tamil, Bengali and eight more scripts, read straight from a photo.' },
  { icon: BookOpen, title: 'Discover unfamiliar dishes', text: 'Plain-language explanations of what a dish is and how it tastes.' },
  { icon: UtensilsCrossed, title: 'Explore ingredients and preparation', text: 'Likely ingredients and cooking methods, clearly marked as estimates.' },
  { icon: Flame, title: 'Check estimated spice levels', text: 'From mild to very spicy, with how confident the estimate is.' },
  { icon: Leaf, title: 'Identify dietary information', text: 'Vegetarian, vegan and non-vegetarian labels — only when there’s evidence.' },
];

export function HomeScreen() {
  const { openMenu } = useStore();
  return (
    <>
      {/* Hero */}
      <section className="mx-auto grid max-w-[1240px] items-center gap-8 px-4 pb-12 pt-8 md:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] md:gap-12 md:px-8 md:pb-20 md:pt-14">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[13px] font-medium text-brand ring-1 ring-line">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            Menu translator for travellers in India
          </p>
          <h1 className="mt-4 font-heading text-[36px] leading-[1.08] text-ink sm:text-[44px] lg:text-[54px]">
            Discover Indian food. <span className="text-brand">Understand every dish.</span>
          </h1>
          <p className="mt-4 max-w-xl text-[17px] leading-relaxed text-ink/80 md:text-lg">
            Simply scan a restaurant menu and explore Indian dishes in your language.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={() => navigate('upload')}>
              <ScanLine size={20} aria-hidden="true" />
              Start Translating
            </Button>
            <Button size="lg" variant="secondary" onClick={() => openMenu(DEMO_MENU_ID)}>
              Try Sample Menu
              <ArrowRight size={18} aria-hidden="true" />
            </Button>
          </div>
          <p className="mt-4 text-[14px] text-ink/65">Free to use · No sign-up · Your photos stay on your device until you choose to translate</p>
        </div>

        <div className="relative mx-auto w-full max-w-[520px]">
          <ThaliIllustration className="h-auto w-full" />
          {/* Floating product preview: what a translated card looks like */}
          <div className="absolute -bottom-4 left-0 w-[64%] min-w-[210px] rounded-2xl bg-white p-3.5 shadow-lift sm:left-[-4%] sm:p-4" aria-hidden="true">
            <p lang="hi" className="text-[13px] text-muted">
              मसाला डोसा
            </p>
            <p className="font-heading text-[16px] font-semibold text-ink">Masala Dosa</p>
            <p className="mt-1 text-[12.5px] leading-snug text-ink/75">Crispy rice-and-lentil crepe with spiced potato.</p>
            <div className="mt-2 flex items-center gap-2 text-[12px]">
              <span className="rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand">Vegetarian</span>
              <span className="inline-flex text-accent">
                <Flame size={13} className="fill-accent" />
                <Flame size={13} className="fill-accent" />
              </span>
              <span className="ml-auto font-heading text-[14px] font-semibold">₹120</span>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="bg-white" aria-labelledby="how-title">
        <div className="mx-auto max-w-[1240px] px-4 py-14 md:px-8 md:py-20">
          <h2 id="how-title" className="font-heading text-[28px] md:text-[34px]">
            How it works
          </h2>
          <ol className="mt-8 grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} className="relative rounded-2xl bg-cream p-6">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-brand text-white">
                    <s.icon size={21} aria-hidden="true" />
                  </span>
                  <span className="text-[13px] font-semibold text-brand">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 font-heading text-[19px]">{s.title}</h3>
                <p className="mt-1.5 text-[15px] text-ink/75">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Benefits */}
      <section className="mx-auto max-w-[1240px] px-4 py-14 md:px-8 md:py-20" aria-labelledby="benefits-title">
        <h2 id="benefits-title" className="font-heading text-[28px] md:text-[34px]">
          Order with confidence
        </h2>
        <p className="mt-2 max-w-2xl text-ink/75">Go beyond a word-for-word translation and know what you’re ordering.</p>
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {BENEFITS.map((b) => (
            <li key={b.title} className="card flex gap-4 p-5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sage text-brand">
                <b.icon size={21} aria-hidden="true" />
              </span>
              <div>
                <h3 className="font-heading text-[17px]">{b.title}</h3>
                <p className="mt-1 text-[15px] text-muted">{b.text}</p>
              </div>
            </li>
          ))}
          <li className="flex flex-col justify-center gap-3 rounded-[14px] bg-brand p-5 text-white on-brand">
            <p className="font-heading text-[17px]">See it in action</p>
            <p className="text-[15px] text-white/85">Open a sample Hindi menu — no photo needed.</p>
            <button type="button" onClick={() => openMenu(DEMO_MENU_ID)} className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl bg-white px-4 font-medium text-brand hover:bg-cream">
              Try Sample Menu <ArrowRight size={18} aria-hidden="true" />
            </button>
          </li>
        </ul>
      </section>

      {/* Languages */}
      <section className="bg-sage" aria-labelledby="lang-title">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-14 md:grid-cols-2 md:px-8 md:py-20">
          <div>
            <h2 id="lang-title" className="font-heading text-[28px] md:text-[34px]">
              Supported languages
            </h2>
            <p className="mt-2 text-ink/75">Translate menus into:</p>
            <ul className="mt-5 flex flex-wrap gap-2.5">
              {TARGET_LANGUAGES.map((l) => (
                <li key={l.code} className="rounded-full bg-white px-4 py-2 font-medium shadow-card">
                  {l.native}
                  {l.native !== l.name && <span className="ml-1.5 text-[14px] font-normal text-muted">{l.name}</span>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-heading text-[19px]">Reads menus written in</h3>
            <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3">
              {SOURCE_LANGUAGES.map((l) => (
                <li key={l.code} className="text-[15px]">
                  <span lang={l.code} className="font-medium">
                    {l.native}
                  </span>
                  <span className="ml-1.5 text-ink/65">{l.name}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[14px] text-ink/70">Recognition quality depends on photo clarity and the AI model. Low-confidence text is flagged for you to check.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-4 py-10 md:px-8">
        <SafetyNotice />
      </section>
    </>
  );
}
