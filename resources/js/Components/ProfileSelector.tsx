import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/Components/ui/card'
import { Badge } from '@/Components/ui/badge'
import { Check } from 'lucide-react'

interface Profile {
    name: string
    bandwidth?: string
    rate_limit?: string
}

interface ProfileSelectorProps {
    profiles: Profile[]  // Now passed directly as prop!
    selectedProfile: string | null
    onSelect: (profile: Profile) => void
    disabled?: boolean
}

export function ProfileSelector({ profiles, selectedProfile, onSelect, disabled }: ProfileSelectorProps) {
    if (!profiles || profiles.length === 0) {
        return (
            <div className="text-center py-8 border-2 border-dashed rounded-lg">
                <p className="text-muted-foreground mb-2">No profiles synced for this router</p>
                <p className="text-xs text-muted-foreground">
                    Run a Full Sync on this router to populate profiles
                </p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
                Select a profile ({profiles.length} available):
            </p>
            <div className="grid gap-3 md:grid-cols-2">
                {profiles.map((profile) => {
                    const isSelected = selectedProfile === profile.name
                    const bandwidth = profile.bandwidth || 'Unknown'

                    return (
                        <Card
                            key={profile.name}
                            className={`cursor-pointer transition-all hover:shadow-md ${isSelected
                                    ? 'ring-2 ring-primary bg-primary/5'
                                    : 'hover:border-primary/50'
                                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                            onClick={() => !disabled && onSelect(profile)}
                        >
                            <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono font-semibold">
                                                {profile.name}
                                            </span>
                                            {isSelected && (
                                                <Check className="h-4 w-4 text-primary" />
                                            )}
                                        </div>
                                        <Badge variant="secondary" className="mt-2 font-normal">
                                            {bandwidth}
                                        </Badge>
                                        {profile.rate_limit && (
                                            <p className="text-xs text-muted-foreground mt-1 font-mono">
                                                {profile.rate_limit}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
