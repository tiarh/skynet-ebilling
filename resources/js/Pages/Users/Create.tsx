import UserForm from './UserForm';

interface Area {
    id: number;
    name: string;
    code: string;
}

interface Props {
    areas: Area[];
}

export default function Create({ areas }: Props) {
    return <UserForm areas={areas} />;
}
