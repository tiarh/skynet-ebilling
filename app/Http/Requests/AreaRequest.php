<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AreaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $areaId = $this->route('area')?->id;

        return [
            'name' => ['required', 'string', 'max:255', Rule::unique('areas', 'name')->ignore($areaId)],
            'code' => ['required', 'string', 'max:255', Rule::unique('areas', 'code')->ignore($areaId)],
        ];
    }
}
