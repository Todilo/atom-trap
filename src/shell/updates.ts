import { registerSW } from 'virtual:pwa-register';

/**
 * New versions of the game (ADR-0016): the service worker downloads a new deploy in the background,
 * and the player chooses when to switch, from the "Reload / Later" bar or Settings. A phone keeps the
 * game open for days and switching back to it doesn't reload the page, so the game also checks on
 * resume, on the title screen and hourly, at most once a minute.
 */
export type UpdateCheck = 'idle' | 'checking' | 'latest' | 'failed';

export class Updates {
  /** A new version has downloaded and waits for a reload. */
  ready = false;
  /** Settings' manual check, while it runs and after. */
  manual: UpdateCheck = 'idle';
  private registration: ServiceWorkerRegistration | undefined;
  private lastCheck = 0;
  private readonly applyUpdate: (reload?: boolean) => Promise<void>;

  /** `bar`: the "Reload / Later" bar; `changed` redraws whatever shows the update state. */
  constructor(
    private readonly bar: HTMLElement,
    private readonly changed: () => void,
  ) {
    this.applyUpdate = registerSW({
      immediate: true,
      onNeedRefresh: () => (this.ready = true),
      onRegisteredSW: (_url, registration) => {
        this.registration = registration;
        if (registration) setInterval(() => void this.check().catch(() => {}), 60 * 60 * 1000);
      },
    });
    bar.addEventListener('click', (e) => {
      const action = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')?.dataset.action;
      if (action === 'update') this.apply();
      else if (action === 'later') this.ready = false;
    });
  }

  /** False in development, where there is no service worker. */
  get available(): boolean {
    return this.registration !== undefined;
  }

  apply(): void {
    void this.applyUpdate(true);
  }

  /** Shows the bar only when there's a version waiting and no game in progress would be lost. */
  showBar(betweenGames: boolean): void {
    this.bar.hidden = !this.ready || !betweenGames;
  }

  /**
   * Asks the server for a new version, at most once a minute unless `force`d. Resolves once a new
   * version has had time to download; `ready` then says whether one did.
   */
  async check(force = false): Promise<void> {
    const reg = this.registration;
    if (!reg || (!force && Date.now() - this.lastCheck < 60_000)) return;
    this.lastCheck = Date.now();
    await reg.update();
    const installing = reg.installing;
    if (installing) {
      await new Promise<void>((resolve) => {
        installing.addEventListener('statechange', () => installing.state !== 'installing' && resolve());
        setTimeout(resolve, 20_000);
      });
      // The page hears about the waiting version just after it installs.
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  /** Settings' "Check for updates". */
  async checkNow(): Promise<void> {
    this.manual = 'checking';
    this.changed();
    try {
      await this.check(true);
      this.manual = 'latest';
    } catch {
      this.manual = 'failed';
    }
    this.changed();
  }

  /** What Settings' version row shows. */
  get status(): UpdateCheck | 'ready' | 'unavailable' {
    if (!this.available) return 'unavailable';
    return this.ready ? 'ready' : this.manual;
  }
}
