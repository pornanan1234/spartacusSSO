import { HttpClientModule } from "@angular/common/http";
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MsalModule, MsalRedirectComponent,MsalGuardConfiguration } from "@azure/msal-angular";
import { BrowserCacheLocation, IPublicClientApplication, InteractionType, LogLevel, PublicClientApplication } from "@azure/msal-browser";
import { EffectsModule } from "@ngrx/effects";
import { StoreModule } from "@ngrx/store";
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { SpartacusModule} from './spartacus/spartacus.module';
import {CustomLoginFormModule} from './spartacus/features/login-sso/login-form.module'
import { MsalGuard, MsalInterceptor, MsalBroadcastService, MsalInterceptorConfiguration, 
   MsalService, MSAL_GUARD_CONFIG, MSAL_INSTANCE, MSAL_INTERCEPTOR_CONFIG } from '@azure/msal-angular';
import { MSALSpaAuthService } from "./spartacus/features/login-sso/service/msal-auth-service";
import { MSALAuthHttpHeaderService } from "./spartacus/features/login-sso/service/msal-auth-http-header.service";
import { AuthHttpHeaderService, AuthService } from "@spartacus/core";


const isIE =
  window.navigator.userAgent.indexOf("MSIE ") > -1 ||
  window.navigator.userAgent.indexOf("Trident/") > -1;

  export function loggerCallback(logLevel: LogLevel, message: string) {
    console.log(message);
  }

export function MSALGuardConfigFactory(): MsalGuardConfiguration {
  return { 
    interactionType: InteractionType.Redirect,
    authRequest: {
      scopes: ['user.read']
    }
  };
}

export function MSALInstanceFactory(): IPublicClientApplication {
  return new PublicClientApplication({
    auth: {
      clientId: 'f228b2ba-2ecd-4885-a997-a066ae89bb3c',
      authority: 'https://login.microsoftonline.com/60b66503-c42b-43ba-9c16-9dbe907cb249',
      redirectUri: 'https://localhost:4200'
    },
    cache: {
      cacheLocation: BrowserCacheLocation.LocalStorage,
      storeAuthStateInCookie: isIE, // set to true for IE 11
    },
    system: {
      loggerOptions: {
        loggerCallback,
        logLevel: LogLevel.Info,
        piiLoggingEnabled: false
      }
    }
  });
}
// provides authRequest configuration
export function MSALInterceptorConfigFactory(): MsalInterceptorConfiguration {
  const protectedResourceMap = new Map<string, Array<string>>();
  protectedResourceMap.set('https://graph.microsoft.com/v1.0/me', ['user.read']);
return {
    interactionType: InteractionType.Redirect,
    protectedResourceMap
  };
}

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule,
    StoreModule.forRoot({}),
    EffectsModule.forRoot([]),
    SpartacusModule,
    CustomLoginFormModule,
    MsalModule.forRoot(
      new PublicClientApplication({
        auth: {
          clientId: 'a1ba3c8c-fc5c-4be8-bd62-37fa74b54be3', // Application (client) ID from the app registration
          authority: 'https://login.microsoftonline.com/60b66503-c42b-43ba-9c16-9dbe907cb249', // The Azure cloud instance and the app's sign-in audience (tenant ID, common, organizations, or consumers)
          redirectUri: 'https://localhost:4200/', // This is your redirect URI
          postLogoutRedirectUri: 'https://localhost:4200/',
        },
        cache: {
          cacheLocation: "localStorage",
          storeAuthStateInCookie: isIE, // Set to true for Internet Explorer 11
        },
      }),
      MSALGuardConfigFactory(),
      MSALInterceptorConfigFactory()
    ),
  ],

  providers: [{
    provide: AuthHttpHeaderService,
      useExisting: MSALAuthHttpHeaderService,
    },
    {
      provide: AuthService,
      useExisting: MSALSpaAuthService,
    },
    {
      provide: MSAL_GUARD_CONFIG,
      useFactory: MSALGuardConfigFactory
    },
    {
      provide: MSAL_INTERCEPTOR_CONFIG,
      useFactory: MSALInterceptorConfigFactory
    }
  ],


  bootstrap: [AppComponent, MsalRedirectComponent]
})
export class AppModule { }
