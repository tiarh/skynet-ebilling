import UserForm from './UserForm';

interface Area {
    id: number;
    name: string;
    code: string;
}

interface ManagedUser {
    id: number;
    name: string;
    email: string;
    role: 'superadmin' | 'admin';
    areas: Area[];
}

interface Props {
    managedUser: ManagedUser;
    areas: Area[];
}

export default function Edit({ managedUser, areas }: Props) {
    return <UserForm managedUser={managedUser} areas={areas} />;
}
