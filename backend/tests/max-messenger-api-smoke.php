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

$requests = [];
Http::fake(function (Request $request) use (&$requests) {
    $requests[] = [
        'method' => $request->method(),
        'url' => $request->url(),
        'authorization' => $request->header('Authorization'),
        'data' => $request->data(),
    ];

    if (str_starts_with($request->url(), 'https://platform-api2.max.ru/uploads?type=file')) {
        return Http::response([
            'url' => 'https://uploads.example.test/file',
            'token' => 'test-upload-token',
        ], 200);
    }

    if ($request->url() === 'https://uploads.example.test/file') {
        return Http::response([], 200);
    }

    if (str_starts_with($request->url(), 'https://platform-api2.max.ru/messages?chat_id=')) {
        return Http::response(['message' => ['mid' => 'test-message']], 200);
    }

    return Http::response(['error' => 'unexpected request'], 404);
});

assertMaxApi(
    MaxMessengerService::sendMessage('123456', 'Тестовое уведомление'),
    'sendMessage accepts successful official API response'
);

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
} finally {
    @unlink($tempFile);
}

$messageRequests = array_values(array_filter(
    $requests,
    fn (array $request): bool => str_starts_with($request['url'], 'https://platform-api2.max.ru/messages?')
));
$uploadInitRequests = array_values(array_filter(
    $requests,
    fn (array $request): bool => str_starts_with($request['url'], 'https://platform-api2.max.ru/uploads?')
));
$fileUploadRequests = array_values(array_filter(
    $requests,
    fn (array $request): bool => $request['url'] === 'https://uploads.example.test/file'
));

assertMaxApi(count($messageRequests) === 2, 'text and file are sent through POST /messages');
assertMaxApi(
    $messageRequests[0]['method'] === 'POST'
        && $messageRequests[0]['url'] === 'https://platform-api2.max.ru/messages?chat_id=123456'
        && $messageRequests[0]['authorization'] === 'ci-max-test-token'
        && ($messageRequests[0]['data']['text'] ?? null) === 'Тестовое уведомление',
    'sendMessage uses official endpoint and raw Authorization token'
);
assertMaxApi(
    count($uploadInitRequests) === 1
        && $uploadInitRequests[0]['method'] === 'POST'
        && $uploadInitRequests[0]['authorization'] === 'ci-max-test-token',
    'file upload initialization uses authenticated POST /uploads'
);
assertMaxApi(
    count($fileUploadRequests) === 1
        && $fileUploadRequests[0]['method'] === 'POST'
        && $fileUploadRequests[0]['authorization'] === null,
    'multipart upload does not forward the bot token to the upload host'
);
$attachmentData = $messageRequests[1]['data'];
assertMaxApi(
    $messageRequests[1]['url'] === 'https://platform-api2.max.ru/messages?chat_id=123456'
        && $messageRequests[1]['authorization'] === 'ci-max-test-token'
        && ($attachmentData['text'] ?? null) === 'Протокол встречи'
        && ($attachmentData['attachments'][0]['type'] ?? null) === 'file'
        && ($attachmentData['attachments'][0]['payload']['token'] ?? null) === 'test-upload-token',
    'file is sent as an official MAX file attachment token'
);

echo "All BCS MAX Bot API smoke checks passed." . PHP_EOL;
