import { AlertTriangle,PackageOpen,X } from 'lucide-react'; import type { ReactNode } from 'react';
export const Panel=({title,children,className=''}:{title?:string;children:ReactNode;className?:string})=><section className={`panel ${className}`}>{title&&<h2 className="panel-title"><span/> {title}</h2>}{children}</section>;
export const Loading=({label='Sincronizando dados...'}:{label?:string})=><main className="center-state"><div className="scan-core"/><b>SISTEMA</b><span>{label}</span></main>;
export const Empty=({text}:{text:string})=><div className="empty"><PackageOpen/><span>{text}</span></div>;
export const ErrorState=({text}:{text:string})=><div className="error-state"><AlertTriangle/><span>{text}</span></div>;
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){return <div className="modal-backdrop" role="presentation" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header><h2 id="modal-title">{title}</h2><button className="icon-button" onClick={onClose} aria-label="Fechar"><X/></button></header>{children}</section></div>}
