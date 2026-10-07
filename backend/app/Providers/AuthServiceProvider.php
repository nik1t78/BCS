<?php

namespace App\Providers;

use App\Models\User;
use Illuminate\Foundation\Support\Providers\AuthServiceProvider as ServiceProvider;
use Illuminate\Support\Facades\Gate;

class AuthServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        // Маршруты админки защищены через middleware('can:admin') и
        // ('can:admin-or-moderator'), но соответствующие Gate-абилити нигде
        // не регистрировались. Из-за этого Laravel считал проверку проваленной
        // и отдавал 403 на всех админских эндпоинтах — «админка не работала».
        Gate::define('admin', fn (User $user): bool => $user->isAdmin());
        Gate::define('moderator', fn (User $user): bool => $user->isModerator());
        Gate::define('admin-or-moderator', fn (User $user): bool => $user->isAdminOrModerator());
    }
}
