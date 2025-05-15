import { render } from '@react-email/render';
import WelcomeEmail from './WelcomeEmail';

type Props = {
  name?: string;
  plan?: string;
};

export const generateWelcomeEmail = async ({ name, plan }: Props): Promise<string> => {
  return render(
    <WelcomeEmail
      name={name ?? 'Athlete'}
      plan={plan ?? 'your custom training plan'}
    />
  );
};
