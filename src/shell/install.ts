/**
 * The browser's offer to install the game as an app (Chrome, Edge, Android), for the title's Install
 * button: many phone players never find "Add to home screen" in the browser menu.
 */
type InstallOffer = Event & { prompt(): Promise<void>; userChoice: Promise<unknown> };

export class Install {
  private offer: InstallOffer | null = null;

  /** `changed` redraws the title when the button should appear or go. */
  constructor(private readonly changed: () => void) {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.offer = e as InstallOffer;
      changed();
    });
    window.addEventListener('appinstalled', () => {
      this.offer = null;
      changed();
    });
  }

  get available(): boolean {
    return this.offer !== null;
  }

  async install(): Promise<void> {
    const offer = this.offer;
    if (!offer) return;
    await offer.prompt();
    await offer.userChoice;
    // An offer can only be used once; the browser sends a new one if it still applies.
    this.offer = null;
    this.changed();
  }
}
