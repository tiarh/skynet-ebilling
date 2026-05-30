<?php

namespace App\Http\Controllers;

use App\Models\SupportTicket;
use Illuminate\Http\Request;

class SupportTicketController extends Controller
{
    public function index(Request $request)
    {
        return response()->json(SupportTicket::query()
            ->with(['customer:id,code,name,phone', 'assignee:id,name'])
            ->when($request->status && $request->status !== 'all', fn ($query) => $query->where('status', $request->status))
            ->when($request->type && $request->type !== 'all', fn ($query) => $query->where('type', $request->type))
            ->latest()
            ->paginate((int) $request->input('limit', 50)));
    }

    public function store(Request $request)
    {
        $ticket = SupportTicket::create($request->validate([
            'customer_id' => ['nullable', 'exists:customers,id'],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'type' => ['nullable', 'in:installation,incident,billing,request,other'],
            'priority' => ['nullable', 'in:low,normal,high,urgent'],
            'subject' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_at' => ['nullable', 'date'],
            'meta' => ['nullable', 'array'],
        ]));

        return response()->json($ticket->load(['customer:id,code,name', 'assignee:id,name']), 201);
    }

    public function update(Request $request, SupportTicket $ticket)
    {
        $ticket->update($request->validate([
            'assigned_to' => ['nullable', 'exists:users,id'],
            'type' => ['nullable', 'in:installation,incident,billing,request,other'],
            'priority' => ['nullable', 'in:low,normal,high,urgent'],
            'status' => ['nullable', 'in:open,assigned,in_progress,resolved,closed,cancelled'],
            'subject' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'due_at' => ['nullable', 'date'],
            'meta' => ['nullable', 'array'],
        ]));

        if (in_array($ticket->status, ['resolved', 'closed'], true) && ! $ticket->resolved_at) {
            $ticket->update(['resolved_at' => now()]);
        }

        return response()->json($ticket->fresh(['customer:id,code,name', 'assignee:id,name']));
    }
}
