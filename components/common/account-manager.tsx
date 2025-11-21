// web/components/common/account-manager.tsx
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface Account {
  id: number;
  type: string;
  username: string;
}

interface AccountManagerProps {
  children: React.ReactNode;
  onSelectAccount: (accountId: number) => void;
}

export function AccountManager({ children, onSelectAccount }: AccountManagerProps) {
  const [open, setOpen] = React.useState(false);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [newAccount, setNewAccount] = React.useState({ type: 'KTX', username: '', password: '' });
  const [message, setMessage] = React.useState('');

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      if (response.ok) {
        const data = await response.json();
        setAccounts(data);
      }
    } catch (error) {
      console.error('Failed to fetch accounts', error);
    }
  };

  React.useEffect(() => {
    if (open) {
      fetchAccounts();
    }
  }, [open]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewAccount(prev => ({ ...prev, [name]: value }));
  };

  const handleAddAccount = async () => {
    setMessage('Adding account...');
    try {
      const response = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAccount),
      });
      if (response.ok) {
        setMessage('Account added successfully!');
        setNewAccount({ type: 'KTX', username: '', password: '' });
        fetchAccounts();
      } else {
        const errorData = await response.json();
        setMessage(`Failed to add account: ${errorData.message}`);
      }
    } catch (error) {
      setMessage('An error occurred.');
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Manage Accounts</DialogTitle>
          <DialogDescription>Select an existing account or add a new one.</DialogDescription>
        </DialogHeader>
        
        <Tabs defaultValue="select" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="select">Select Account</TabsTrigger>
            <TabsTrigger value="add">Add Account</TabsTrigger>
          </TabsList>
          
          <TabsContent value="select">
            <ScrollArea className="h-72 w-full rounded-md border p-4">
              <div className="space-y-2">
                {accounts.length > 0 ? (
                  accounts.map(acc => (
                    <div
                      key={acc.id}
                      onClick={() => {
                        onSelectAccount(acc.id);
                        setOpen(false);
                      }}
                      className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-md cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      <div className="font-semibold">{acc.username}</div>
                      <div className="text-sm text-muted-foreground">{acc.type}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground">No accounts found. Please add one.</p>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="add">
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="type" className="text-right">Type</Label>
                <Tabs defaultValue="KTX" onValueChange={(val) => setNewAccount(p => ({...p, type: val}))} className="col-span-3">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="KTX">KTX</TabsTrigger>
                    <TabsTrigger value="SRT">SRT</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="username-add" className="text-right">회원 번호</Label>
                <Input id="username-add" name="username" value={newAccount.username} onChange={handleInputChange} className="col-span-3" placeholder="Membership No." />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="password" className="text-right">Password</Label>
                <Input id="password" name="password" type="password" value={newAccount.password} onChange={handleInputChange} className="col-span-3" />
              </div>
              {message && <p className="text-center text-sm text-muted-foreground">{message}</p>}
            </div>
            <DialogFooter>
              <Button onClick={handleAddAccount}>Add Account</Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
        
      </DialogContent>
    </Dialog>
  );
}
