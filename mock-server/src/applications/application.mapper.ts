import type { Application } from './application.model.js';
import { maskValue } from './mask.util.js';

export type PublicApplication = Application;

export function toPublicApplication(application: Application, options: { unmask?: boolean } = {}): PublicApplication {
  if (options.unmask) {
    return { ...application };
  }
  return {
    ...application,
    registrationNumber: maskValue(application.registrationNumber),
    ownerNid: maskValue(application.ownerNid),
    bankAccountNumber: maskValue(application.bankAccountNumber),
  };
}
