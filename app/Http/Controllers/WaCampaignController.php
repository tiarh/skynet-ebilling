<?php

namespace App\Http\Controllers;

use App\Http\Requests\BroadcastStoreRequest;
use App\Models\WaCampaign;
use App\Models\Area;
use App\Jobs\ProcessWaCampaign;
use App\Jobs\SendWaCampaignMessage;
use App\Support\AreaScope;
use Illuminate\Http\Request;
use Inertia\Inertia;

class WaCampaignController extends Controller
{
    public function index()
    {
        $query = WaCampaign::with('targetArea')->latest();
        AreaScope::applyToCampaigns($query, request()->user());
        $campaigns = $query->paginate(10);

        return Inertia::render('Broadcasts/Index', [
            'campaigns' => $campaigns
        ]);
    }

    public function create()
    {
        $areasQuery = Area::query();
        AreaScope::applyToAreas($areasQuery, request()->user());

        return Inertia::render('Broadcasts/Create', [
            'areas' => $areasQuery->get()
        ]);
    }

    public function store(BroadcastStoreRequest $request)
    {
        $validated = $request->validated();
        if ($request->user()->hasAreaScope()) {
            AreaScope::authorizeAreaId(isset($validated['target_area_id']) ? (int) $validated['target_area_id'] : null, $request->user());
        }

        $campaign = WaCampaign::create($validated);

        // Dispatch the Process job
        ProcessWaCampaign::dispatch($campaign);

        return redirect()->route('broadcasts.index')->with('success', 'Campaign created and is processing.');
    }

    public function show(WaCampaign $campaign)
    {
        AreaScope::authorizeCampaign($campaign, request()->user());

        $campaign->load('targetArea');
        $recipients = $campaign->recipients()
            ->with('customer')
            ->when(request()->user()->hasAreaScope(), function ($query) {
                $areaIds = request()->user()->accessibleAreaIds()->all();
                empty($areaIds)
                    ? $query->whereRaw('1 = 0')
                    : $query->whereHas('customer', fn ($customer) => $customer->whereIn('area_id', $areaIds));
            })
            ->orderBy('id', 'desc')
            ->paginate(20);

        return Inertia::render('Broadcasts/Show', [
            'campaign' => $campaign,
            'recipients' => $recipients
        ]);
    }

    public function retryFailed(WaCampaign $campaign)
    {
        AreaScope::authorizeCampaign($campaign, request()->user());

        $failedRecipients = $campaign->recipients()->where('status', 'failed')->get();

        if ($failedRecipients->isEmpty()) {
            return back()->with('success', 'No failed messages to retry.');
        }

        // Adjust counts
        $campaign->update([
            'failed_count' => $campaign->failed_count - $failedRecipients->count(),
            'status' => 'processing'
        ]);

        $delaySeconds = 0;
        foreach ($failedRecipients as $recipient) {
            $recipient->update(['status' => 'pending', 'error_message' => null]);
            $delaySeconds += rand(4, 9);
            SendWaCampaignMessage::dispatch($recipient)->delay(now()->addSeconds($delaySeconds));
        }

        return back()->with('success', 'Retrying failed messages. They have been queued.');
    }
}
