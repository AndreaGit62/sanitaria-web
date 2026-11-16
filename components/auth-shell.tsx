import Link from 'next/link';
import BrandLogo from './brand-logo';
import { ShieldCheck, Heart } from 'lucide-react';
export default function AuthShell({title, description, children}: {title:string;description:string;children:React.ReactNode}) {
  return <div className="auth-shell"><aside className="auth-story"><Link href="/" className="brand"><BrandLogo/></Link><div><span className="auth-kicker">IL TUO SPAZIO PERSONALE</span><h1>Prendersi cura di sé.<br/>Con un pensiero in meno.</h1><p>Un unico posto per ritrovare il tuo percorso di salute, dal computer e dall’iPhone.</p><div className="auth-trust"><ShieldCheck size={20}/> Accesso personale con email e password</div></div><span className="auth-story-footer"><Heart size={16}/> Un po’ di ordine, un po’ di serenità.</span></aside><main className="auth-main"><section className="auth-card"><span className="auth-kicker">BENVENUTO IN VISILAB</span><h1>{title}</h1><p>{description}</p>{children}</section></main></div>;
}
