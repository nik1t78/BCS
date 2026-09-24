<?php

namespace App\Providers;

use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        // Приложение работает за nginx (terminate TLS / проксирует /api),
        // поэтому доверяем заголовкам X-Forwarded-*, чтобы генерировать
        // корректные абсолютные URL в ответах API.
        if (method_exists(URL::class, 'forceRootUrl') && $this->app->environment('production')) {
            URL::forceScheme(request()->isSecure() ? 'https' : 'http');
        }
    }
}
