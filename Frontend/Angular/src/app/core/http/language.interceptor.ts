import { HttpInterceptorFn } from '@angular/common/http';

export const languageInterceptor: HttpInterceptorFn = (req, next) => {
  const storedLang = localStorage.getItem('app_language');
  const htmlLang = document?.documentElement?.lang;
  const lang = storedLang || htmlLang || 'en';

  return next(req.clone({ setHeaders: { 'Accept-Language': lang } }));
};
