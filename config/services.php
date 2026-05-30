<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'legacy_scraper' => [
        'url' => env('LEGACY_SCRAPER_URL', 'http://scraping-ebilling.103.156.128.102.sslip.io'),
    ],

    'wireguard' => [
        'interface' => env('WIREGUARD_INTERFACE', 'wg0'),
        'endpoint' => env('WIREGUARD_ENDPOINT'),
        'port' => env('WIREGUARD_PORT', 51820),
        'server_address' => env('WIREGUARD_SERVER_ADDRESS', '10.99.0.1'),
        'public_key' => env('WIREGUARD_PUBLIC_KEY'),
        'public_key_path' => env('WIREGUARD_PUBLIC_KEY_PATH', '/etc/wireguard/server_public.key'),
        'allowed_ips' => env('WIREGUARD_ALLOWED_IPS', '10.99.0.0/24'),
    ],

];
