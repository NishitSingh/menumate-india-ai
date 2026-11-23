import { BottomNavigation, Footer, Header, Toasts } from './components/Layout';
import { useRoute } from './state/router';
import { StoreProvider } from './state/store';
import { HomeScreen } from './screens/HomeScreen';
import { UploadScreen } from './screens/UploadScreen';
import { LanguageScreen } from './screens/LanguageScreen';
import { ProcessingScreen } from './screens/ProcessingScreen';
import { MenuScreen } from './screens/MenuScreen';
import { PreferencesScreen } from './screens/PreferencesScreen';
import { SavedScreen } from './screens/SavedScreen';
import { InfoScreen } from './screens/InfoScreen';

function Screens() {
  const route = useRoute();
  let screen;
  switch (route) {
    case 'upload':
      screen = <UploadScreen />;
      break;
    case 'language':
      screen = <LanguageScreen />;
      break;
    case 'processing':
      screen = <ProcessingScreen />;
      break;
    case 'menu':
      screen = <MenuScreen />;
      break;
    case 'preferences':
      screen = <PreferencesScreen />;
      break;
    case 'saved':
      screen = <SavedScreen />;
      break;
    case 'about':
    case 'how-it-works':
    case 'privacy':
    case 'contact':
    case 'disclaimer':
      screen = <InfoScreen route={route} />;
      break;
    default:
      screen = <HomeScreen />;
  }
  return (
    <>
      <a href="#main" onClick={(e) => (e.preventDefault(), document.getElementById('main')?.focus())} className="sr-only z-50 rounded-lg bg-brand px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
        Skip to content
      </a>
      <Header route={route} />
      <main id="main" tabIndex={-1} className="min-h-[70vh] outline-none">
        {screen}
      </main>
      <Footer />
      <BottomNavigation route={route} />
      <Toasts />
    </>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Screens />
    </StoreProvider>
  );
}
