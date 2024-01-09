/*
 * SPDX-FileCopyrightText: 2023 SAP Spartacus team <spartacus-team@sap.com>
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { MsalBroadcastService, MsalService } from '@azure/msal-angular';
import {
  AuthenticationResult,
  EventMessage,
  EventType,
} from '@azure/msal-browser';
import {
  catchError,
  filter,
  map,
  switchMap,
  take,
  takeUntil,
  tap,
} from 'rxjs/operators';
import {
  BehaviorSubject,
  combineLatest,
  EMPTY,
  Observable,
  of,
  Subject,
  Subscription,
  throwError,
} from 'rxjs';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  AuthActions,
  AuthConfigService,
  AuthRedirectService,
  AuthService,
  AuthStorageService,
  AuthToken,
  BaseSiteService,
  GlobalMessageService,
  GlobalMessageType,
  OCC_USER_ID_CURRENT,
  User,
  UserIdService,
} from '@spartacus/core';
import { Store } from '@ngrx/store';
import { UserAccountFacade } from '@spartacus/user/account/root';

export interface MSALAuthenticationResponse {
  eventType: string;
  payload: MSALResponsePayload;
}

export interface MSALResponsePayload {
  accessToken: string;
  expiresOn: Date;
  idToken: string;
  account: MSALAccountInformation;
}

export interface MSALAccountInformation {
  name: string;
  username: string;
}

@Component({
  selector: 'cx-login-form',
  templateUrl: './login-form.component.html',
  styleUrls: ['./login-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomLoginFormComponent implements OnInit {
  title = 'msal-spartacus';
  isIframe = false;
  loginDisplay = new BehaviorSubject(false);
  loader$ = new BehaviorSubject(false);
  data: MSALAuthenticationResponse|undefined;
  private readonly _destroying$ = new Subject<void>();
  protected subscription: Subscription = new Subscription();
  user$: Observable<User | undefined> |undefined;

  constructor(
    private msalService: MsalService,
    private msalBroadcastService: MsalBroadcastService,
    protected http: HttpClient,
    protected authConfigService: AuthConfigService,
    protected store: Store,
    protected authStorageService: AuthStorageService,
    protected userIdService: UserIdService,
    protected globalMessageService: GlobalMessageService,
    protected authRedirectService: AuthRedirectService,
    protected baseSiteService: BaseSiteService,
    private auth: AuthService,
    private userAccount: UserAccountFacade
  ) {}

  ngOnInit() {
    this.subscription.add(
      combineLatest([
        this.baseSiteService.getActive(),
        this.msalBroadcastService.msalSubject$.pipe(
          tap((msg: EventMessage) => {
            console.log('Events fired from MSAL ... ' + JSON.stringify(msg));
          }),
          filter(
            (msg: EventMessage) =>
              msg.eventType === EventType.LOGIN_SUCCESS ||
              msg.eventType === EventType.ACQUIRE_TOKEN_SUCCESS ||
              msg.eventType === EventType.SSO_SILENT_SUCCESS
          )
        ),
      ])
        .pipe(takeUntil(this._destroying$))
        .subscribe(([baseSite, result]) => {
          this.setLoginDisplay();
          this.loader$.next(true);
          const event = result as EventMessage;
          const payload = event.payload as AuthenticationResult;
          this.msalService.instance.setActiveAccount(payload.account);
          this.loadTokenUsingCustomFlow(payload.idToken, baseSite).subscribe(
            (res) => {
              this.loginWithToken(res);
            }
          );
        })
    );

    // We can also handle Any Issue in Login with MSAL By Subscribing to MsalBroadcastService and its event EventType

    this.isIframe = window !== window.parent && !window.opener;
    this.setLoginDisplay();
  }

  login() {
    this.msalService.loginRedirect().subscribe({
      next: (result) => {
        this.setLoginDisplay();
      },
      error: (error) => console.log(error),
    });
  }

  setLoginDisplay() {
    console.log(
      'MSAL logged In? :' + this.msalService.instance.getAllAccounts().length
    );
    this.loginDisplay.next(
      this.msalService.instance.getAllAccounts().length > 0
    );
    this.user$ = this.auth.isUserLoggedIn().pipe(
      switchMap((isUserLoggedIn) => {
        if (isUserLoggedIn) {
          return this.userAccount.get();
        } else {
          return of(undefined);
        }
      })
    );
  }

  loadTokenUsingCustomFlow(
    UID: string,
    baseSite: string
  ): Observable<unknown>  |Observable<Partial<AuthToken>  & { expires_in?: number } >  {
    const url = this.authConfigService.getTokenEndpoint();
    const params = new HttpParams()
      .set('client_id', this.authConfigService.getClientId())
      .set('client_secret', this.authConfigService.getClientSecret())
      .set('grant_type', 'custom')
      .set('UID', encodeURIComponent(UID))
      .set('baseSite', encodeURIComponent(baseSite));

    return this.http
      .post<Partial<AuthToken>  & { expires_in?: number }>(url, params)
      .pipe(catchError((error) => this.handleAuthError(error)));
  }
  handleAuthError(error: any): any {
    this.globalMessageService.add(
      error.message ? error.message : { key: 'httpHandlers.unknownIdentifier' },
      GlobalMessageType.MSG_TYPE_ERROR
    );
    this.setLoginDisplay();
    return of();
  }

  /**
   * Transform and store the token received from custom flow to library format and login user.
   *
   * @param token
   */
  loginWithToken(token: unknown| Partial<AuthToken> & { expires_in?: number }): void {
    let stream$ = of(true);
    stream$.pipe(take(1)).subscribe((canLogin) => {
      if (canLogin) {
        // Code mostly based on auth lib we use and the way it handles token properties
        this.setTokenData(token);

        // OCC specific code
        this.userIdService.setUserId(OCC_USER_ID_CURRENT);

        this.store.dispatch(new AuthActions.Login());

        // Remove any global errors and redirect user on successful login
        this.globalMessageService.remove(GlobalMessageType.MSG_TYPE_ERROR);
        this.loader$.next(false);
        this.authRedirectService.redirect();
      }
    });
  }

  protected setTokenData(token: any): void {
    this.authStorageService.setItem('access_token', token.access_token);

    if (token.granted_scopes && Array.isArray(token.granted_scopes)) {
      this.authStorageService.setItem(
        'granted_scopes',
        JSON.stringify(token.granted_scopes)
      );
    }

    this.authStorageService.setItem('access_token_stored_at', '' + Date.now());

    if (token.expires_in) {
      const expiresInMilliseconds = token.expires_in * 1000;
      const now = new Date();
      const expiresAt = now.getTime() + expiresInMilliseconds;
      this.authStorageService.setItem('expires_at', '' + expiresAt);
    }

    if (token.refresh_token) {
      this.authStorageService.setItem('refresh_token', token.refresh_token);
    }
  }

  ngOnDestroy(): void {
    this._destroying$.next(undefined);
    this._destroying$.complete();
  }
}