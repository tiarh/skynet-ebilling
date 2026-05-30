<?php

namespace Tests\Unit;

use App\Services\LegacyAreaCoordinateService;
use PHPUnit\Framework\TestCase;

class LegacyAreaCoordinateServiceTest extends TestCase
{
    public function test_it_parses_normal_coordinates(): void
    {
        $coordinate = (new LegacyAreaCoordinateService())->parse('-7.858129, 112.686149');

        $this->assertSame(-7.858129, $coordinate['lat']);
        $this->assertSame(112.686149, $coordinate['lng']);
    }

    public function test_it_parses_safe_comma_decimal_coordinates(): void
    {
        $coordinate = (new LegacyAreaCoordinateService())->parse('-7,788014,112.752410');

        $this->assertSame(-7.788014, $coordinate['lat']);
        $this->assertSame(112.752410, $coordinate['lng']);
    }

    public function test_it_rejects_unusable_coordinates(): void
    {
        $service = new LegacyAreaCoordinateService();

        $this->assertNull($service->parse('0'));
        $this->assertNull($service->parse('0,0'));
        $this->assertNull($service->parse('https://maps.app.goo.gl/example'));
        $this->assertNull($service->parse('not a coordinate'));
    }

    public function test_it_finds_nearest_centroid(): void
    {
        $service = new LegacyAreaCoordinateService();
        $centroids = $service->centroids([
            'SKYNET-BEDALI' => [
                ['lat' => -7.858, 'lng' => 112.686],
                ['lat' => -7.859, 'lng' => 112.687],
            ],
            'SKYNET-KARANGPLOSO' => [
                ['lat' => -7.890, 'lng' => 112.597],
                ['lat' => -7.891, 'lng' => 112.598],
            ],
        ]);

        $nearest = $service->nearest(['lat' => -7.8585, 'lng' => 112.6865], $centroids);

        $this->assertSame('SKYNET-BEDALI', $nearest['area']);
    }
}
