import { useState } from 'react';
import { BookOpen, Heart, ScanLine, Trash2 } from 'lucide-react';
import type { SavedMenu } from '../lib/types';
import { targetName } from '../lib/languages';
import { Badge, Button, PageHeader, cx, formatDate, formatPrice } from '../components/ui';
import { EmptyState, InfoNote } from '../components/Feedback';
import { ConfirmationModal } from '../components/Modal';
import { DEMO_MENU_ID } from '../data/sampleMenu';
import { navigate } from '../state/router';
import { useStore } from '../state/store';

export function SavedMenuCard({ menu, onOpen, onDelete }: { menu: SavedMenu; onOpen: () => void; onDelete: () => void }) {
  return (
    <article className="card flex gap-4 p-4" aria-labelledby={`menu-${menu.id}`}>
      {menu.thumbnail ? (
        <img src={menu.thumbnail} alt={`Thumbnail of ${menu.title}`} className="h-24 w-20 shrink-0 rounded-lg object-cover ring-1 ring-line" />
      ) : (
        <div className="grid h-24 w-20 shrink-0 place-items-center rounded-lg bg-sage text-brand" aria-hidden="true">
          <ScanLine size={24} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 id={`menu-${menu.id}`} className="font-heading text-[17px]">
          {menu.title}
        </h3>
        <p className="text-[14px] text-muted">
          {formatDate(menu.createdAt)} · into {targetName(menu.targetLanguage)} · {menu.items.length} dishes
        </p>
        {menu.status === 'partial' && (
          <Badge tone="danger" className="mt-1 self-start">
            Partly translated
          </Badge>
        )}
        <div className="mt-auto flex gap-2 pt-3">
          <Button size="sm" onClick={onOpen}>
            Open menu
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="text-danger hover:bg-danger-soft" aria-label={`Delete ${menu.title} from ${formatDate(menu.createdAt)}`}>
            <Trash2 size={16} aria-hidden="true" /> Delete
          </Button>
        </div>
      </div>
    </article>
  );
}

export function SavedScreen() {
  const { menus, favourites, deleteMenu, openMenu, removeFavourite, getMenu, notify } = useStore();
  const [tab, setTab] = useState<'menus' | 'favourites'>('menus');
  const [toDelete, setToDelete] = useState<SavedMenu | null>(null);

  const tabs = [
    { id: 'menus' as const, label: 'Translated menus', count: menus.length, icon: BookOpen },
    { id: 'favourites' as const, label: 'Favourite dishes', count: favourites.length, icon: Heart },
  ];

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 md:px-8 md:py-12">
      <PageHeader title="My Menus" subtitle="Menus you’ve translated and dishes you’ve saved." />

      <div role="tablist" aria-label="Saved items" className="mb-6 inline-flex rounded-xl bg-white p-1 shadow-card">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => setTab(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const next = tab === 'menus' ? 'favourites' : 'menus';
                setTab(next);
                document.getElementById(`tab-${next}`)?.focus();
              }
            }}
            className={cx('flex min-h-11 items-center gap-2 rounded-lg px-4 text-[15px] font-medium', tab === t.id ? 'bg-brand text-white' : 'text-ink hover:bg-sage')}
          >
            <t.icon size={17} aria-hidden="true" />
            {t.label}
            <span className={cx('rounded-full px-2 text-[12px]', tab === t.id ? 'bg-white/20' : 'bg-sage')}>{t.count}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'menus' &&
          (menus.length === 0 ? (
            <EmptyState
              icon={<BookOpen size={28} aria-hidden="true" />}
              title="No translated menus yet"
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => navigate('upload')}>Translate a menu</Button>
                  <Button variant="secondary" onClick={() => openMenu(DEMO_MENU_ID)}>
                    Try Sample Menu
                  </Button>
                </div>
              }
            >
              Menus you translate are saved here automatically so you can check them again later.
            </EmptyState>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {menus.map((m) => (
                <li key={m.id}>
                  <SavedMenuCard menu={m} onOpen={() => openMenu(m.id)} onDelete={() => setToDelete(m)} />
                </li>
              ))}
            </ul>
          ))}

        {tab === 'favourites' &&
          (favourites.length === 0 ? (
            <EmptyState icon={<Heart size={28} aria-hidden="true" />} title="No favourites yet" action={<Button onClick={() => openMenu(DEMO_MENU_ID)}>Browse the sample menu</Button>}>
              Tap the heart on any dish to keep it here.
            </EmptyState>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {favourites.map((f) => {
                const menu = getMenu(f.menuId);
                const item = menu?.items.find((i) => i.id === f.itemId);
                const name = item?.translatedName ?? f.snapshot.translatedName;
                return (
                  <li key={`${f.menuId}-${f.itemId}`} className="card flex items-center gap-3 p-4">
                    <Heart size={20} className="shrink-0 fill-accent text-accent" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-heading text-[16px] font-semibold">{name}</p>
                      <p className="truncate text-[14px] text-muted">
                        {f.snapshot.originalName}
                        {f.snapshot.priceINR !== null && ` · ${formatPrice(f.snapshot.priceINR)}`}
                        {menu ? ` · ${menu.isDemo ? 'Sample menu' : menu.title}` : ' · menu deleted'}
                      </p>
                    </div>
                    {menu && item && (
                      <Button size="sm" variant="secondary" onClick={() => openMenu(menu.id, item.id)} aria-label={`Open ${name}`}>
                        Open
                      </Button>
                    )}
                    <button
                      type="button"
                      onClick={() => (removeFavourite(f.menuId, f.itemId), notify(`Removed ${name} from favourites`))}
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink/70 hover:bg-danger-soft hover:text-danger"
                      aria-label={`Remove ${name} from favourites`}
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ))}
      </div>

      <InfoNote className="mt-8">
        Saved menus and favourites live only in this browser on this device. They aren’t synced to an account, and clearing your browser data will remove them.
        Menu photos aren’t stored — only a small thumbnail.
      </InfoNote>

      <ConfirmationModal
        open={!!toDelete}
        title="Delete this menu?"
        message={toDelete ? `“${toDelete.title}” from ${formatDate(toDelete.createdAt)} and any favourites from it will be removed from this device.` : ''}
        confirmLabel="Delete menu"
        onCancel={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) {
            deleteMenu(toDelete.id);
            notify('Menu deleted');
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}
