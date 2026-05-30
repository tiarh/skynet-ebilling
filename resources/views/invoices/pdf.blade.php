<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Invoice {{ $invoice->code }}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'DejaVu Sans', Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.5;
            color: #333;
        }
        
        .container {
            padding: 20mm;
        }
        
        /* Header Section */
        .header {
            display: table;
            width: 100%;
            margin-bottom: 20px;
        }
        
        .header-left {
            display: table-cell;
            width: 50%;
            vertical-align: top;
        }
        
        .header-right {
            display: table-cell;
            width: 50%;
            vertical-align: top;
            text-align: right;
        }
        
        .logo {
            max-width: 180px;
            height: auto;
        }
        
        .invoice-meta {
            font-size: 9pt;
            line-height: 1.8;
        }
        
        .invoice-meta strong {
            font-weight: 600;
        }
        
        /* Company & Customer Section */
        .info-section {
            display: table;
            width: 100%;
            margin: 20px 0;
            border-top: 2px solid #e5e7eb;
            border-bottom: 2px solid #e5e7eb;
            padding: 15px 0;
        }
        
        .company-info {
            display: table-cell;
            width: 50%;
            vertical-align: top;
            padding-right: 20px;
        }
        
        .customer-info {
            display: table-cell;
            width: 50%;
            vertical-align: top;
            text-align: right;
        }
        
        .section-title {
            font-size: 11pt;
            font-weight: 700;
            margin-bottom: 8px;
            color: #1e40af;
        }
        
        .info-line {
            font-size: 9pt;
            line-height: 1.6;
            color: #4b5563;
        }
        
        /* Line Items Table */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        
        .items-table th {
            background-color: #f3f4f6;
            padding: 10px;
            text-align: left;
            font-weight: 600;
            font-size: 10pt;
            border-bottom: 2px solid #d1d5db;
        }
        
        .items-table th.amount {
            text-align: right;
        }
        
        .items-table td {
            padding: 10px;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .items-table td.amount {
            text-align: right;
            font-weight: 500;
        }
        
        /* Total Section */
        .total-section {
            margin: 20px 0;
            padding: 15px;
            background-color: #f9fafb;
            border: 1px solid #e5e7eb;
            text-align: right;
        }
        
        .total-label {
            font-size: 11pt;
            font-weight: 700;
            display: inline-block;
            margin-right: 20px;
        }
        
        .total-amount {
            font-size: 14pt;
            font-weight: 700;
            color: #1e40af;
            display: inline-block;
        }
        
        /* Payment Methods */
        .payment-section {
            margin: 20px 0;
        }
        
        .payment-title {
            font-size: 11pt;
            font-weight: 700;
            margin-bottom: 10px;
            color: #1e40af;
        }
        
        .payment-subtitle {
            font-size: 10pt;
            font-weight: 600;
            margin: 15px 0 5px 0;
        }
        
        .payment-details {
            background-color: #f9fafb;
            padding: 10px;
            margin: 5px 0;
            border-left: 3px solid #1e40af;
            font-size: 9pt;
        }
        
        .account-number {
            font-family: 'Courier New', monospace;
            font-weight: 700;
            font-size: 10pt;
        }
        
        /* Footer */
        .footer {
            margin-top: 40px;
            text-align: right;
        }
        
        .footer-date {
            font-size: 9pt;
            color: #6b7280;
            margin-bottom: 40px;
        }
        
        .footer-company {
            font-size: 10pt;
            font-weight: 600;
        }
        
        /* Utility Classes */
        .text-muted {
            color: #6b7280;
        }
        
        .text-bold {
            font-weight: 600;
        }
        
        .mb-small {
            margin-bottom: 5px;
        }
    </style>
</head>
<body>
    <div class="container">
        @php
            \Carbon\Carbon::setLocale('id');
        @endphp
        <!-- Header: Logo and Invoice Metadata -->
        <div class="header">
            <div class="header-left">
                @php
                    $logoPath = public_path('images/logo.png');
                    $logoData = base64_encode(file_get_contents($logoPath));
                    $logoSrc = 'data:image/png;base64,' . $logoData;
                @endphp
                <img src="{{ $logoSrc }}" alt="Skynet Logo" class="logo">
            </div>
            <div class="header-right">
                <div class="invoice-meta">
                    <div><strong>Invoice #:</strong> {{ $invoice->code }}</div>
                    <div><strong>Periode:</strong> {{ \Carbon\Carbon::parse($invoice->period)->translatedFormat('F Y') }}</div>
                    <div><strong>Jatuh Tempo:</strong> {{ \Carbon\Carbon::parse($invoice->due_date)->translatedFormat('d F Y') }}</div>
                    <div><strong>ID Pelanggan:</strong> {{ $invoice->customer->code }}</div>
                </div>
            </div>
        </div>

        <!-- ... (middle sections) ... -->

        <!-- Line Items -->
        <table class="items-table">
            <thead>
                <tr>
                    <th>Item</th>
                    <th class="amount">Harga</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>
                        <strong>{{ $invoice->customer->package->name }}</strong>
                        <div class="text-muted" style="font-size: 9pt;">
                            ({{ \Carbon\Carbon::parse($invoice->period)->translatedFormat('F Y') }})
                        </div>
                    </td>
                    <td class="amount">{{ number_format($invoice->amount, 0, ',', '.') }}</td>
                </tr>
                
                @php
                    $totalPaid = $invoice->transactions->sum('amount');
                @endphp
                
                @if($totalPaid > 0)
                <tr>
                    <td><strong>Nominal Sudah Bayar</strong></td>
                    <td class="amount">{{ number_format($totalPaid, 0, ',', '.') }}</td>
                </tr>
                @endif
            </tbody>
        </table>

        <!-- Total Section -->
        <div class="total-section">
            <span class="total-label">Total:</span>
            <span class="total-amount">Rp {{ number_format($invoice->amount, 0, ',', '.') }}</span>
        </div>

        <!-- Payment Methods -->
        <div class="payment-section">
            <div class="payment-title">Info Pembayaran:</div>
            
            @foreach($manual_accounts as $account)
            <div class="payment-details">
                <div class="text-bold">{{ $account['bank'] }} A/N {{ $company['name'] }}</div>
                <div class="account-number">{{ $account['account_number'] }}</div>
            </div>
            @endforeach
        </div>

        <!-- Footer -->
        <div class="footer">
            <div class="footer-date">{{ \Carbon\Carbon::parse($invoice->period)->translatedFormat('F Y') }}</div>
            <div class="footer-company">{{ $company['name'] }}</div>
        </div>
    </div>
</body>
</html>
