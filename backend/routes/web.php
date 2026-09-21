<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return response()->json([
        'message' => 'ВКС Расписание API',
        'version' => '1.0.0',
    ]);
});
