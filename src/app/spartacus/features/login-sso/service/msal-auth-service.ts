/*
 * SPDX-FileCopyrightText: 2023 SAP Spartacus team <spartacus-team@sap.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { Injectable } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { EndSessionRequest } from '@azure/msal-browser';
import { Store } from '@ngrx/store';
import { AsmAuthStorageService } from '@spartacus/asm/root';
import { environment } from '../../../../../environments/environment';
import {
  AuthMultisiteIsolationService,
  AuthRedirectService,
  AuthService,
  GlobalMessageService,
  OAuthLibWrapperService,
  RoutingService,
  StateWithClientAuth,
  UserIdService,
} from '@spartacus/core';

/**
 * Version of AuthService that is working for both user na CS agent.
 * Overrides AuthService when ASM module is enabled.
 */
@Injectable({
  providedIn: 'root',
})
export class MSALSpaAuthService extends AuthService {
  constructor(
    protected msalService: MsalService,
    protected override store: Store<StateWithClientAuth>,
    protected override userIdService: UserIdService,
    protected override oAuthLibWrapperService: OAuthLibWrapperService,
    protected override authStorageService: AsmAuthStorageService,
    protected override authRedirectService: AuthRedirectService,
    protected globalMessageService: GlobalMessageService,
    protected override routingService: RoutingService,
    protected override authMultisiteIsolationService?: AuthMultisiteIsolationService
  ) {
    super(
      store,
      userIdService,
      oAuthLibWrapperService,
      authStorageService,
      authRedirectService,
      routingService,
      authMultisiteIsolationService
    );
  }

  /**
   * Revokes tokens and clears state for logged user (tokens, userId).
   * To perform logout it is best to use `logout` method. Use this method with caution.
   */
  override coreLogout(): Promise<void> {
    return super.coreLogout().finally(() => {
      this.MSALlogout();
    });
  }

  MSALlogout() {
    const session: EndSessionRequest = {
  //    authority: environment.msal.auth.authority,
      onRedirectNavigate: (url) => {
        // The value of 'url' is the URL that MSAL would redirect the user to.
        console.log('Redirect URL is...  ' + url);
        return true;
      },
    };
    this.msalService.logout(session);
  }
}