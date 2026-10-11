export const PROMOTO_SHELL_MARKUP = `
  <section class="hagilight-promoto__shell" data-promoto-shell hidden aria-label="Featured promotion">
    <div class="hagilight-promoto__viewport">
      <div class="hagilight-promoto__track" data-promoto-track></div>
    </div>
    <nav class="hagilight-promoto__controls" data-promoto-controls aria-label="Promotion controls" hidden>
      <button type="button" class="hagilight-promoto__control" data-promoto-previous aria-label="Previous promotion">
        <svg class="hagilight-promoto__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 6l-6 6 6 6" /></svg>
      </button>
      <span class="hagilight-promoto__count" data-promoto-count aria-label="Promotion progress"></span>
      <button type="button" class="hagilight-promoto__control" data-promoto-next aria-label="Next promotion">
        <svg class="hagilight-promoto__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6l6 6-6 6" /></svg>
      </button>
      <button type="button" class="hagilight-promoto__control" data-promoto-pause aria-pressed="false" aria-label="Pause automatic promotion rotation">
        <svg class="hagilight-promoto__icon hagilight-promoto__icon--pause" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 6v12M15 6v12" /></svg>
        <svg class="hagilight-promoto__icon hagilight-promoto__icon--play" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M8 5.5v13l11-6.5z" /></svg>
      </button>
    </nav>
    <button type="button" class="hagilight-promoto__dismiss" data-promoto-dismiss aria-label="Dismiss promotion">
      <svg class="hagilight-promoto__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></svg>
    </button>
    <span class="hagilight-promoto__status" data-promoto-status aria-live="polite"></span>
  </section>
`;
