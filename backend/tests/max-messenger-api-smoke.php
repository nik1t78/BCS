<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Services\MaxMessengerService;
use Illuminate\Contracts\Console\Kernel as ConsoleKernel;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

$app = require __DIR__ . '/../bootstrap/app.php';
$app->make(ConsoleKernel::class)->bootstrap();

config([
    'services.messenger' => 'max',
    'services.max.enabled' => true,
    'services.max.token' => 'ci-max-test-token',
    'services.max.api_url' => 'https://platform-api2.max.ru',
]);

function assertMaxApi(bool $condition, string $message): void
{
    if (!$condition) {
        fwrite(STDERR, "[FAIL] {$message}" . PHP_EOL);
        exit(1);
    }

    echo "[PASS] {$message}" . PHP_EOL;
}

// Старые значения из прежнего шаблона BCS автоматически мигрируют на
// официальный API base URL, пользовательские URL при этом сохраняются.
config(['services.max.api_url' => 'https://maxapi.ru/v1']);
assertMaxApi(
    MaxMessengerService::apiUrl() === 'https://platform-api2.max.ru',
    'legacy MAX API base URL is normalized to official platform-api2'
);
config(['services.max.api_url' => 'https://platform-api2.max.ru']);

Http::fake([
    'https://platform-api2.max.ru/messages*' => Http::response(['message' => ['mid' => 'test-message']], 200),
    'https://platform-api2.max.ru/uploads*' => Http::response([
        'url' => 'https://uploads.example.test/file',
        'token' => 'test-upload-token',
    ], 200),
    'https://uploads.example.test/*' => Http::response([], 200),
]);

assertMaxApi(
    MaxMessengerService::sendMessage('123456', 'Тестовое уведомление'),
    'sendMessage accepts successful official API response'
);
Http::assertSent(function (Request $request): bool {
    return $request->method() === 'POST'
        && $request->url() === 'https://platform-api2.max.ru/messages?chat_id=123456'
        && $request->hasHeader('Authorization', 'ci-max-test-token')
        && ($request->data()['text'] ?? null) === 'Тестовое уведомление';
});
echo "[PASS] sendMessage uses POST /messages?chat_id and raw Authorization token" . PHP_EOL;

$tempFile = tempnam(sys_get_temp_dir(), 'bcs-max-upload-');
if ($tempFile === false) {
    throw new RuntimeException('Unable to create temporary MAX upload fixture');
}

try {
    file_put_contents($tempFile, 'BCS MAX upload smoke fixture');
    assertMaxApi(
        MaxMessengerService::sendFile('123456', $tempFile, 'protocol.txt', 'Протокол встречи'),
        'sendFile completes upload and message flow'
    );

    Http::assertSent(function (Request $request): bool {
        return $request->method() === 'POST'
            && str_starts_with($request->url(), 'https://platform-api2.max.ru/uploads?type=file')
            && $request->hasHeader('Authorization', 'ci-max-test-token');
    });
    Http::assertSent(function (Request $request): bool {
        return $request->method() === 'POST'
            && $request->url() === 'https://uploads.example.test/file'
            && !$request->hasHeader('Authorization');
    });
    Http::assertSent(function (Request $request): bool {
        $data = $request->data();
        return $request->method() === 'POST'
            && $request->url() === 'https://platform-api2.max.ru/messages?chat_id=123456'
            && $request->hasHeader('Authorization', 'ci-max-test-token')
            && ($data['text'] ?? null) === 'Протокол встречи'
            && ($data['attachments'][0]['type'] ?? null) === 'file'
            && ($data['attachments'][0]['payload']['token'] ?? null) === 'test-upload-token';
    });
    echo "[PASS] sendFile uses official upload token and file attachment flow" . PHP_EOL;
} finally {
    @unlink($tempFile);
}

echo "All BCS MAX Bot API smoke checks passed." . PHP_EOL;
