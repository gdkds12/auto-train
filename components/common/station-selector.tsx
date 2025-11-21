// web/components/common/station-selector.tsx
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Drawer, DrawerContent, DrawerTrigger } from '@/components/ui/drawer';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useMediaQuery } from '@/hooks/use-media-query';

interface Station {
  name: string;
  code: string;
}

interface StationSelectorProps {
  stations: Station[];
  onSelect: (station: Station) => void;
  children: React.ReactNode;
}

export function StationSelector({ stations, onSelect, children }: StationSelectorProps) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery('(min-width: 768px)');

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <StationList stations={stations} onSelect={onSelect} setOpen={setOpen} />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{children}</DrawerTrigger>
      <DrawerContent>
        <div className="mt-4 border-t">
          <StationList stations={stations} onSelect={onSelect} setOpen={setOpen} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function StationList({
  stations,
  onSelect,
  setOpen,
}: {
  stations: Station[];
  onSelect: (station: Station) => void;
  setOpen: (open: boolean) => void;
}) {
  return (
    <Command>
      <CommandInput placeholder="Search station..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup>
          {stations.map((station) => (
            <CommandItem
              key={station.code}
              value={station.name}
              onSelect={() => {
                onSelect(station);
                setOpen(false);
              }}
            >
              {station.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
