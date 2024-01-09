/*
 * SPDX-FileCopyrightText: 2023 SAP Spartacus team <spartacus-team@sap.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { HttpEvent, HttpHandler, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  AuthHttpHeaderService,
  AuthRedirectService,
  AuthService,
  AuthStorageService,
  AuthToken,
  GlobalMessageService,
  OAuthLibWrapperService,
  OccEndpointsService,
  RoutingService,
} from '@spartacus/core';
import { Observable, EMPTY, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { MSALSpaAuthService } from './msal-auth-service';

/**
 * Overrides `AuthHttpHeaderService` to handle asm calls as well (not only OCC)
 * in cases of normal user session and on customer emulation.
 */
@Injectable({
  providedIn: 'root',
})
export class MSALAuthHttpHeaderService extends AuthHttpHeaderService {
  constructor(
    protected msalAuthServide: MSALSpaAuthService,
    protected override authService: AuthService,
    protected override authStorageService: AuthStorageService,
    protected override oAuthLibWrapperService: OAuthLibWrapperService,
    protected override routingService: RoutingService,
    protected override globalMessageService: GlobalMessageService,
    protected occEndpointsService: OccEndpointsService,
    protected override authRedirectService: AuthRedirectService
  ) {
    super(
      authService,
      authStorageService,
      oAuthLibWrapperService,
      routingService,
      occEndpointsService,
      globalMessageService,
      authRedirectService
    );
  }

  /**
   * Refreshes access_token and then retries the call with the new token.
   */
  public override handleExpiredAccessToken(
    request: HttpRequest<any>,
    next: HttpHandler,
    initialToken: AuthToken | undefined
  ): Observable<HttpEvent<AuthToken>> {
    this.handleExpiredRefreshToken();
    return of<HttpEvent<any>>();
  }

  /**
   * Logout user, redirected to login page and informs about expired session.
   */
  public override handleExpiredRefreshToken(): void {
    // There might be 2 cases:
    // 1. when user is already on some page (router is stable) and performs an UI action
    // that triggers http call (i.e. button click to save data in backend)
    // 2. when user is navigating to some page and a route guard triggers the http call
    // (i.e. guard loading cms page data)
    //
    // In the second case, we want to remember the anticipated url before we navigate to
    // the login page, so we can redirect back to that URL after user authenticates.
    this.authRedirectService.saveCurrentNavigationUrl();

    // Logout user
    // TODO(#9638): Use logout route when it will support passing redirect url
    this.msalAuthServide.coreLogout();
  }
}