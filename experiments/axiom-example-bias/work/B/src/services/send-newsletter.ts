import type { Result } from "../domain/types.js";
import type { Store } from "../store/memory-store.js";

/** Input for composing one newsletter dispatch. */
export interface SendNewsletterInput {
  subject: string;
}

/** A composed dispatch: who receives the newsletter, under what subject. */
export interface NewsletterDispatch {
  subject: string;
  /** Unique review authors — the members who hear from us. */
  recipients: string[];
}

/**
 * Composes a newsletter dispatch to every member who has reviewed a
 * parlor.
 *
 * Failure modes: empty subject; no reviews on record, so nobody to
 * send to.
 */
export function run(store: Store, input: SendNewsletterInput): Result<NewsletterDispatch> {
  if (input.subject.trim() === "") {
    return { ok: false, error: 'subject must be a non-empty line, like "Summer flavors!"' };
  }

  const recipients = [...new Set(store.listReviews().map((review) => review.author))];

  if (recipients.length === 0) {
    return { ok: false, error: "no members have reviewed yet — there is nobody to send to" };
  }

  return { ok: true, value: { subject: input.subject.trim(), recipients } };
}
