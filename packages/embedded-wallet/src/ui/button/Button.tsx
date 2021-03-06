import React from 'react';
import {Icon, Icons} from '../icon/Icon';
import css from './Button.module.css';

export type ButtonProps = {
  icon?: Icons;
  iconPosition?: 'left' | 'right';
  type: 'primary' | 'secondary';
  label: string;
  onClick: () => void;
};

const Button: React.FC<ButtonProps> = ({type, label, onClick, icon, iconPosition = 'right'}) => (
  <button
    autoFocus={type === 'primary'}
    onClick={onClick}
    className={`${css.button} ${css[type]} ${icon ? css[`${iconPosition}Icon`] : ''}`.trim()}
  >
    <span className={css.buttonLabel}>{label}</span>
    {icon ? <Icon name={icon} /> : null}
  </button>
);

export {Button};
