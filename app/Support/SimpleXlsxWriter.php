<?php

namespace App\Support;

use Illuminate\Support\Facades\File;
use RuntimeException;
use ZipArchive;

class SimpleXlsxWriter
{
    /**
     * @param array<int, string> $headers
     * @param iterable<int, array<int, mixed>> $rows
     */
    public static function create(string $filename, array $headers, iterable $rows): string
    {
        if (! class_exists(ZipArchive::class)) {
            throw new RuntimeException('The PHP zip extension is required to create XLSX exports.');
        }

        $directory = self::temporaryDirectory();

        $xlsxPath = tempnam($directory, pathinfo($filename, PATHINFO_FILENAME) . '-');
        $sheetPath = tempnam($directory, 'sheet-');
        if ($xlsxPath === false || $sheetPath === false) {
            throw new RuntimeException('Failed to create temporary XLSX export files.');
        }

        $sheet = fopen($sheetPath, 'wb');
        if ($sheet === false) {
            throw new RuntimeException('Failed to open temporary XLSX worksheet file.');
        }

        try {
            fwrite($sheet, '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
            fwrite($sheet, '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>');
            self::writeRow($sheet, 1, $headers, true);

            $rowNumber = 2;
            foreach ($rows as $row) {
                self::writeRow($sheet, $rowNumber, $row);
                $rowNumber++;
            }

            fwrite($sheet, '</sheetData></worksheet>');
        } finally {
            fclose($sheet);
        }

        $zip = new ZipArchive();
        if ($zip->open($xlsxPath, ZipArchive::OVERWRITE) !== true) {
            File::delete($sheetPath);
            throw new RuntimeException('Failed to create XLSX archive.');
        }

        $zip->addFromString('[Content_Types].xml', self::contentTypesXml());
        $zip->addFromString('_rels/.rels', self::rootRelationshipsXml());
        $zip->addFromString('xl/workbook.xml', self::workbookXml());
        $zip->addFromString('xl/_rels/workbook.xml.rels', self::workbookRelationshipsXml());
        $zip->addFile($sheetPath, 'xl/worksheets/sheet1.xml');
        $zip->close();

        File::delete($sheetPath);

        return $xlsxPath;
    }

    private static function temporaryDirectory(): string
    {
        $directory = storage_path('app/exports');
        File::ensureDirectoryExists($directory);

        if (is_dir($directory) && is_writable($directory)) {
            return $directory;
        }

        $fallback = sys_get_temp_dir();
        if (! is_dir($fallback) || ! is_writable($fallback)) {
            throw new RuntimeException('No writable temporary directory is available for XLSX exports.');
        }

        return $fallback;
    }

    /**
     * @param resource $handle
     * @param array<int, mixed> $values
     */
    private static function writeRow($handle, int $rowNumber, array $values, bool $header = false): void
    {
        fwrite($handle, '<row r="' . $rowNumber . '">');

        foreach (array_values($values) as $index => $value) {
            $cell = self::columnName($index + 1) . $rowNumber;

            if (! $header && is_numeric($value) && $value !== '') {
                fwrite($handle, '<c r="' . $cell . '"><v>' . $value . '</v></c>');
                continue;
            }

            fwrite($handle, '<c r="' . $cell . '" t="inlineStr"><is><t>' . self::escape((string) $value) . '</t></is></c>');
        }

        fwrite($handle, '</row>');
    }

    private static function columnName(int $number): string
    {
        $name = '';
        while ($number > 0) {
            $number--;
            $name = chr(65 + ($number % 26)) . $name;
            $number = intdiv($number, 26);
        }

        return $name;
    }

    private static function escape(string $value): string
    {
        return htmlspecialchars($value, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    private static function contentTypesXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            . '<Default Extension="xml" ContentType="application/xml"/>'
            . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
            . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
            . '</Types>';
    }

    private static function rootRelationshipsXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
            . '</Relationships>';
    }

    private static function workbookXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheets><sheet name="Export" sheetId="1" r:id="rId1"/></sheets>'
            . '</workbook>';
    }

    private static function workbookRelationshipsXml(): string
    {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            . '</Relationships>';
    }
}
