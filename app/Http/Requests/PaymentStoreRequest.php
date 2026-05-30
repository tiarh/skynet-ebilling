<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PaymentStoreRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'amount' => ['required', 'numeric', 'min:0'],
            'method' => ['required', Rule::in(['cash', 'transfer', 'payment_gateway'])],
            'proof' => ['nullable', 'image', 'max:2048'],
            'paid_at' => ['nullable', 'date'],
        ];
    }
}
